# frozen_string_literal: true

class UpdateStatusService < BaseService
  include Redisable
  include LanguagesHelper

  class NoChangesSubmittedError < StandardError; end

  # Kronk: audience axes an edit may change (docs/rebuild/per_post_audience.md).
  AUDIENCE_KEYS = %i(visibility krew_ids audience_grant_ids audience_exclude_ids).freeze

  # @param [Status] status
  # @param [Integer] account_id
  # @param [Hash] options
  # @option options [Array<Integer>] :media_ids
  # @option options [Array<Hash>] :media_attributes
  # @option options [Hash] :poll
  # @option options [String] :text
  # @option options [String] :spoiler_text
  # @option options [Boolean] :sensitive
  # @option options [String] :language
  def call(status, account_id, options = {})
    @status                    = status
    @options                   = options
    @account_id                = account_id
    @media_attachments_changed = false
    @poll_changed              = false
    @audience_changed          = false

    Status.transaction do
      create_previous_edit!
      # Capture who currently has this status in their home feed *before* we
      # touch the audience, so we can pull it back from anyone who loses access.
      @old_recipient_ids = editing_audience? ? local_home_recipient_ids : nil
      apply_audience_changes! if editing_audience?
      update_media_attachments! if @options.key?(:media_ids)
      update_poll! if @options.key?(:poll)
      update_immediate_attributes!
      create_edit!
    end

    reconcile_audience_feeds! if editing_audience?
    queue_poll_notifications!
    reset_preview_card!
    update_metadata!
    broadcast_updates!

    @status
  rescue NoChangesSubmittedError
    # For calls that result in no changes, swallow the error
    # but get back to the original state

    @status.reload
  end

  private

  def update_media_attachments!
    previous_media_attachments = @status.ordered_media_attachments.to_a
    next_media_attachments     = validate_media!
    added_media_attachments    = next_media_attachments - previous_media_attachments

    (@options[:media_attributes] || []).each do |attributes|
      media = next_media_attachments.find { |attachment| attachment.id == attributes[:id].to_i }
      next if media.nil?

      media.update!(attributes.slice(:thumbnail, :description, :focus))
      @media_attachments_changed ||= media.significantly_changed?
    end

    MediaAttachment.where(id: added_media_attachments.map(&:id)).update_all(status_id: @status.id)

    @status.ordered_media_attachment_ids = (@options[:media_ids] || []).map(&:to_i) & next_media_attachments.map(&:id)
    @media_attachments_changed ||= previous_media_attachments.map(&:id) != @status.ordered_media_attachment_ids
    @status.media_attachments.reload
  end

  def validate_media!
    return [] if @options[:media_ids].blank? || !@options[:media_ids].is_a?(Enumerable)

    raise Mastodon::ValidationError, I18n.t('media_attachments.validations.too_many') if @options[:media_ids].size > Status::MEDIA_ATTACHMENTS_LIMIT || @options[:poll].present?

    media_attachments = @status.account.media_attachments.where(status_id: [nil, @status.id]).where(scheduled_status_id: nil).where(id: @options[:media_ids].take(Status::MEDIA_ATTACHMENTS_LIMIT).map(&:to_i)).to_a

    not_found_ids = @options[:media_ids].map(&:to_i) - media_attachments.map(&:id)
    raise Mastodon::ValidationError, I18n.t('media_attachments.validations.not_found', ids: not_found_ids.join(', ')) if not_found_ids.any?

    raise Mastodon::ValidationError, I18n.t('media_attachments.validations.images_and_video') if media_attachments.size > 1 && media_attachments.find(&:audio_or_video?)
    raise Mastodon::ValidationError, I18n.t('media_attachments.validations.not_ready') if media_attachments.any?(&:not_processed?)

    media_attachments
  end

  def update_poll!
    previous_poll        = @status.preloadable_poll
    @previous_expires_at = previous_poll&.expires_at

    if @options[:poll].present?
      poll = previous_poll || @status.account.polls.new(status: @status, votes_count: 0)

      # If for some reasons the options were changed, it invalidates all previous
      # votes, so we need to remove them
      @poll_changed = true if @options[:poll][:options] != poll.options || ActiveModel::Type::Boolean.new.cast(@options[:poll][:multiple]) != poll.multiple

      poll.options     = @options[:poll][:options]
      poll.hide_totals = @options[:poll][:hide_totals] || false
      poll.multiple    = @options[:poll][:multiple] || false
      poll.expires_in  = @options[:poll][:expires_in]
      poll.reset_votes! if @poll_changed
      poll.save!

      @status.poll_id = poll.id
    elsif previous_poll.present?
      previous_poll.destroy
      @poll_changed = true
      @status.poll_id = nil
    end

    @poll_changed = true if @previous_expires_at != @status.preloadable_poll&.expires_at
  end

  def update_immediate_attributes!
    @status.text         = @options[:text].presence || @options.delete(:spoiler_text) || '' if @options.key?(:text)
    @status.spoiler_text = @options[:spoiler_text] || '' if @options.key?(:spoiler_text)
    @status.sensitive    = @options[:sensitive] || @options[:spoiler_text].present? if @options.key?(:sensitive) || @options.key?(:spoiler_text)
    @status.language     = valid_locale_cascade(@options[:language], @status.language, @status.account.user&.preferred_posting_language, I18n.default_locale)
    @status.quote_approval_policy = @options[:quote_approval_policy] if @options[:quote_approval_policy].present?

    # We raise here to rollback the entire transaction
    raise NoChangesSubmittedError unless significant_changes?

    @status.edited_at = Time.now.utc
    @status.save!
  end

  def reset_preview_card!
    return unless @status.text_previously_changed?

    @status.reset_preview_card!
    LinkCrawlWorker.perform_async(@status.id)
  end

  def update_metadata!
    ProcessHashtagsService.new.call(@status)
    ProcessMentionsService.new.call(@status)
  end

  def broadcast_updates!
    DistributionWorker.perform_async(@status.id, { 'update' => true })
    ActivityPub::StatusUpdateDistributionWorker.perform_async(@status.id)
  end

  def queue_poll_notifications!
    poll = @status.preloadable_poll

    # If the poll had no expiration date set but now has, or now has a sooner
    # expiration date, schedule a notification

    return unless poll.present? && poll.expires_at.present?

    PollExpirationNotifyWorker.remove_from_scheduled(poll.id) if @previous_expires_at.present? && @previous_expires_at > poll.expires_at
    PollExpirationNotifyWorker.perform_at(poll.expires_at + 5.minutes, poll.id)
  end

  def create_previous_edit!
    # We only need to create a previous edit when no previous edits exist, e.g.
    # when the status has never been edited. For other cases, we always create
    # an edit, so the step can be skipped

    return if @status.edits.any?

    @status.snapshot!(at_time: @status.created_at, rate_limit: false)
  end

  def create_edit!
    @status.snapshot!(account_id: @account_id)
  end

  def significant_changes?
    @status.changed? || @poll_changed || @media_attachments_changed || @audience_changed
  end

  # --- Kronk: per-post audience editing --------------------------------------
  # docs/rebuild/per_post_audience.md
  #
  # An edit can change a post's reach tier, targeted krews, and the explicit
  # add/remove "people layer" — not only its text. Every audience change goes
  # through this same edit flow (edited_at bump + snapshot in create_edit!), so
  # it is *transparent*: the post is marked edited for everyone who can still
  # see it. Accounts that lose access are silently pulled from their feed (see
  # reconcile_audience_feeds!) rather than notified.

  def editing_audience?
    return @editing_audience if defined?(@editing_audience)

    @editing_audience = AUDIENCE_KEYS.any? { |key| @options.key?(key) }
  end

  def apply_audience_changes!
    apply_visibility_change! if @options.key?(:visibility)
    apply_krew_changes!      if @options.key?(:krew_ids)
    apply_people_layer!      if @options.key?(:audience_grant_ids) || @options.key?(:audience_exclude_ids)
  end

  def apply_visibility_change!
    next_visibility = @options[:visibility].to_s
    return unless Status.visibilities.key?(next_visibility)
    return if @status.visibility == next_visibility

    @status.visibility = next_visibility
    @audience_changed  = true
  end

  def apply_krew_changes!
    ids   = Array(@options[:krew_ids]).map(&:to_i).reject(&:zero?).uniq
    krews = Krew.where(id: ids, archived: false).select { |krew| krew.member?(@status.account) }

    return if @status.krews.pluck(:id).to_set == krews.to_set(&:id)

    @status.krews     = krews
    @audience_changed = true
  end

  def apply_people_layer!
    # Only the gated scopes carry a people layer. A public post can't be
    # restricted, so both lists are dropped when the (possibly just-changed)
    # scope is public — mirrors PostStatusService#attach_status_to_audience!.
    unless gated_scope?
      cleared = @status.granted_accounts.exists? || @status.excluded_accounts.exists?
      @status.granted_accounts  = []
      @status.excluded_accounts = []
      @audience_changed ||= cleared
      return
    end

    apply_account_set!(:granted_accounts, :audience_grant_ids)
    apply_account_set!(:excluded_accounts, :audience_exclude_ids)
  end

  def apply_account_set!(association, option_key)
    return unless @options.key?(option_key)

    ids = Array(@options[option_key]).map(&:to_i).reject(&:zero?).uniq
    ids = Account.local.where(id: ids).where.not(id: @status.account_id).pluck(:id)

    return if @status.public_send(association).pluck(:id).to_set == ids.to_set

    @status.public_send("#{association}=", Account.where(id: ids))
    @audience_changed = true
  end

  def gated_scope?
    @status.mates_visibility? || @status.orbit_visibility? || @status.self_only_visibility?
  end

  # The set of local accounts whose *home* feed should contain this status,
  # given its current audience state. Mirrors FanOutOnWriteService's local
  # fan-out exactly (reach tier + additive krews + additive grants, minus
  # excluded mates), so an old/new diff tells us precisely who to pull from.
  # The author is never included — they always retain their own post.
  def local_home_recipient_ids
    author_id = @status.account_id
    ids       = Set.new

    case @status.visibility.to_sym
    when :public, :unlisted, :private
      ids.merge(@status.account.followers_for_local_distribution.reorder(nil).pluck(:id))
    when :mates, :orbit
      mate_ids = @status.account.mates.merge(Account.local).where.not(id: author_id).reorder(nil).pluck(:id)
      ids.merge(mate_ids - @status.excluded_accounts.pluck(:id))
    when :self_only
      # No reach-tier recipients; additive axes below may still apply.
    else
      ids.merge(@status.mentions.joins(:account).merge(@status.account.followers_for_local_distribution).reorder(nil).pluck('accounts.id'))
    end

    krew_ids = @status.krews.pluck(:id)
    if krew_ids.any?
      ids.merge(
        KrewMembership.where(krew_id: krew_ids).where.not(account_id: author_id)
                      .joins(:account).merge(Account.local).distinct.reorder(nil).pluck(:account_id)
      )
    end

    ids.merge(@status.granted_accounts.merge(Account.local).where.not(id: author_id).reorder(nil).pluck(:id))
    ids.delete(author_id)
    ids
  end

  # Pull the status from the home feed of every account that just lost access.
  # The add side (newly-granted or widened recipients) is handled by the update
  # fan-out in broadcast_updates!, which inserts into their feeds.
  def reconcile_audience_feeds!
    return if @old_recipient_ids.nil?

    departed = @old_recipient_ids - local_home_recipient_ids
    return if departed.empty?

    Account.where(id: departed.to_a).reorder(nil).find_each do |account|
      FeedManager.instance.unpush_from_home(account, @status)
    end
  end
end
