# frozen_string_literal: true

class PostStatusService < BaseService
  include Redisable
  include LanguagesHelper

  class UnexpectedMentionsError < StandardError
    attr_reader :accounts

    def initialize(message, accounts)
      super(message)
      @accounts = accounts
    end
  end

  # Post a text status update, fetch and notify remote users mentioned
  # @param [Account] account Account from which to post
  # @param [Hash] options
  # @option [String] :text Message
  # @option [Status] :thread Optional status to reply to
  # @option [Status] :quoted_status Optional status to quote
  # @option [String] :quote_approval_policy Approval policy for quotes, one of `public`, `followers` or `nobody`
  # @option [Boolean] :sensitive
  # @option [String] :visibility
  # @option [String] :spoiler_text
  # @option [String] :language
  # @option [String] :scheduled_at
  # @option [Hash] :poll Optional poll to attach
  # @option [Enumerable] :media_ids Optional array of media IDs to attach
  # @option [Doorkeeper::Application] :application
  # @option [String] :idempotency Optional idempotency key
  # @option [Boolean] :with_rate_limit
  # @option [Enumerable] :allowed_mentions Optional array of expected mentioned account IDs, raises `UnexpectedMentionsError` if unexpected accounts end up in mentions
  # @return [Status]
  def call(account, options = {})
    @account     = account
    @options     = options
    @text        = @options[:text] || ''
    @in_reply_to = @options[:thread]
    @quoted_status = @options[:quoted_status]

    return idempotency_duplicate if idempotency_given? && idempotency_duplicate?

    validate_media!
    preprocess_attributes!

    if scheduled?
      schedule_status!
    else
      process_status!
    end

    redis.setex(idempotency_key, 3_600, @status.id) if idempotency_given?

    unless scheduled?
      postprocess_status!
      bump_potential_friendship!
    end

    @status
  rescue Antispam::SilentlyDrop => e
    e.status
  end

  private

  def preprocess_attributes!
    @sensitive    = (@options[:sensitive].nil? ? @account.user&.setting_default_sensitive : @options[:sensitive]) || @options[:spoiler_text].present?
    @text         = @options.delete(:spoiler_text) if @text.blank? && @options[:spoiler_text].present? && @quoted_status.blank?
    @visibility   = @options[:visibility] || @account.user&.setting_default_privacy
    @visibility   = :unlisted if @visibility&.to_sym == :public && @account.silenced?
    @visibility   = :private if @quoted_status&.private_visibility? && %i(public unlisted).include?(@visibility&.to_sym)
    @scheduled_at = @options[:scheduled_at]&.to_datetime
    @scheduled_at = nil if scheduled_in_the_past?
  rescue ArgumentError
    raise ActiveRecord::RecordInvalid
  end

  def process_status!
    @status = @account.statuses.new(status_attributes)
    process_mentions_service.call(@status, save_records: false)
    safeguard_mentions!(@status)
    safeguard_private_mention_quote!(@status)
    attach_quote!(@status)

    antispam = Antispam.new(@status)
    antispam.local_preflight_check!

    # The following transaction block is needed to wrap the UPDATEs to
    # the media attachments when the status is created. Krew
    # attachment lives here too, so `postprocess_status!` (which
    # enqueues fan-out) sees the join rows — fan-out for
    # visibility='krew' reads @status.krews and would otherwise race.
    ApplicationRecord.transaction do
      @status.save!
      attach_status_to_krews!
      attach_status_to_audience!
    end

    publish_reply_nudge!
  end

  # Someone replied to a post — the parent's author is the one recipient.
  # Published AFTER the transaction commits: a subscriber that fires inside it
  # would nudge about a status a rollback then discards.
  def publish_reply_nudge!
    return if @in_reply_to.nil?

    Kronk::StatusNudges.publish(
      'status.replied',
      actor_account_id: @status.account_id,
      recipient_account_id: @in_reply_to.account_id,
      status_id: @status.id,
      in_reply_to_id: @in_reply_to.id,
      # The CTA links to the REPLY, which the actor authored — so the handle in
      # the path is the actor's, not the recipient's.
      actor_acct: @status.account.acct
    )
  end

  # Attach the new Status to any Krews the caller targeted. Membership
  # + archive checks silently drop krews the author can't post to; the
  # status itself is already saved, so this is best-effort join.
  #
  # For visibility='krew' the presence of at least one attached krew is
  # required — enforced at the controller so PostStatusService can
  # stay krew-agnostic when called from other paths (scheduled
  # statuses, etc.).
  # Per-post audience "people layer" (docs/rebuild/per_post_audience.md).
  # Attaches the explicitly-added (`audience_grant_ids`) and explicitly-removed
  # (`audience_exclude_ids`) accounts. Only the gated scopes carry a people
  # layer — a `public` post can't be restricted, so both lists are dropped for
  # it. Local, non-author accounts only (these scopes are local-only, like
  # krew). Best-effort: invalid ids are silently skipped; the status is saved.
  def attach_status_to_audience!
    return unless @status.mates_visibility? || @status.orbit_visibility? || @status.self_only_visibility?

    grant_ids   = audience_ids(:audience_grant_ids)
    exclude_ids = audience_ids(:audience_exclude_ids)
    return if grant_ids.empty? && exclude_ids.empty?

    local_ids = Account.local.where(id: grant_ids | exclude_ids).pluck(:id).to_set

    @status.granted_accounts   = Account.where(id: grant_ids.select { |id| local_ids.include?(id) })
    @status.excluded_accounts  = Account.where(id: exclude_ids.select { |id| local_ids.include?(id) })
  end

  def audience_ids(key)
    Array(@options[key]).map(&:to_i).reject(&:zero?).uniq - [@status.account_id]
  end

  def attach_status_to_krews!
    ids = Array(@options[:krew_ids]).map(&:to_i).reject(&:zero?).uniq
    return if ids.empty?

    # `.active` filters `where(archived_at: nil)` — the Krew archive flag is a
    # timestamp column, not a boolean. Previously read `archived: false` which
    # tripped `PG::UndefinedColumn` and 500'd every krew-targeting post.
    krews = Krew.active.where(id: ids).select { |k| k.member?(@status.account) }
    return if krews.empty?

    krews.each do |k|
      k.statuses << @status unless k.statuses.exists?(id: @status.id)
      Kronk::KornerEvents.publish(
        'krew.post.created',
        krew_id: k.id,
        status_id: @status.id,
        account_id: @status.account_id
      )
    end
  end

  def safeguard_private_mention_quote!(status)
    return if @quoted_status.nil? || @visibility.to_sym != :direct

    # The mentions array test here is awkward because the relationship is not persisted at this time
    return if @quoted_status.account_id == @account.id || status.mentions.to_a.any? { |mention| mention.account_id == @quoted_status.account_id && !mention.silent }

    status.errors.add(:base, I18n.t('statuses.errors.quoted_user_not_mentioned'))
    raise ActiveRecord::RecordInvalid, status
  end

  def attach_quote!(status)
    return if @quoted_status.nil?

    status.quote = Quote.create(quoted_status: @quoted_status, status: status)
    status.quote.ensure_quoted_access

    status.quote.accept! if @quoted_status.local? && StatusPolicy.new(@status.account, @quoted_status).quote?
  end

  def safeguard_mentions!(status)
    return if @options[:allowed_mentions].nil?

    expected_account_ids = @options[:allowed_mentions].map(&:to_i)

    unexpected_accounts = status.mentions.map(&:account).to_a.reject { |mentioned_account| expected_account_ids.include?(mentioned_account.id) }
    return if unexpected_accounts.empty?

    raise UnexpectedMentionsError.new('Post would be sent to unexpected accounts', unexpected_accounts)
  end

  def schedule_status!
    status_for_validation = @account.statuses.build(status_attributes)
    safeguard_private_mention_quote!(status_for_validation)

    antispam = Antispam.new(status_for_validation)
    antispam.local_preflight_check!

    if status_for_validation.valid?
      # Marking the status as destroyed is necessary to prevent the status from being
      # persisted when the associated media attachments get updated when creating the
      # scheduled status.
      status_for_validation.destroy

      # The following transaction block is needed to wrap the UPDATEs to
      # the media attachments when the scheduled status is created

      ApplicationRecord.transaction do
        @status = @account.scheduled_statuses.create!(scheduled_status_attributes)
      end
    else
      raise ActiveRecord::RecordInvalid
    end
  rescue Antispam::SilentlyDrop
    @status = @account.scheduled_status.new(scheduled_status_attributes).tap(&:delete)
  end

  def postprocess_status!
    process_hashtags_service.call(@status)
    Trends.tags.register(@status)
    LinkCrawlWorker.perform_async(@status.id)
    # Two post-types are carved out of fan-out — the Status still
    # exists (so favourites, replies, edit history all work through
    # the standard paths) but nobody's home timeline sees the
    # per-item post. Album photos live under an album card; kronk
    # answers live under a question page. See Status enum.
    DistributionWorker.perform_async(@status.id) unless @status.kronk_answer? || @status.kronk_album_photo?
    # Krew is an additive local-only axis, not a visibility (see
    # docs/rebuild/krew_axis_migration.md): a krew-targeting status carries
    # a reach tier (self_only for migrated posts) whose ActivityPub audience
    # is already empty, so distribution federates to no one — exactly like
    # any self_only/mates/orbit post. No separate krew guard needed.
    ActivityPub::DistributionWorker.perform_async(@status.id) unless @status.kronk_answer? || @status.kronk_album_photo?
    PollExpirationNotifyWorker.perform_at(@status.poll.expires_at, @status.poll.id) if @status.poll
    ActivityPub::QuoteRequestWorker.perform_async(@status.quote.id) if @status.quote&.quoted_status.present? && !@status.quote&.quoted_status&.local?
  end

  def validate_media!
    if @options[:media_ids].blank? || !@options[:media_ids].is_a?(Enumerable)
      @media = []
      return
    end

    raise Mastodon::ValidationError, I18n.t('media_attachments.validations.too_many') if @options[:media_ids].size > Status::MEDIA_ATTACHMENTS_LIMIT || @options[:poll].present?

    @media = @account.media_attachments.where(status_id: nil).where(id: @options[:media_ids].take(Status::MEDIA_ATTACHMENTS_LIMIT).map(&:to_i))

    not_found_ids = @options[:media_ids].map(&:to_i) - @media.map(&:id)
    raise Mastodon::ValidationError, I18n.t('media_attachments.validations.not_found', ids: not_found_ids.join(', ')) if not_found_ids.any?

    raise Mastodon::ValidationError, I18n.t('media_attachments.validations.images_and_video') if @media.size > 1 && @media.find(&:audio_or_video?)
    raise Mastodon::ValidationError, I18n.t('media_attachments.validations.not_ready') if @media.any?(&:not_processed?)
  end

  def process_mentions_service
    ProcessMentionsService.new
  end

  def process_hashtags_service
    ProcessHashtagsService.new
  end

  def scheduled?
    @scheduled_at.present?
  end

  def idempotency_key
    "idempotency:status:#{@account.id}:#{@options[:idempotency]}"
  end

  def idempotency_given?
    @options[:idempotency].present?
  end

  def idempotency_duplicate
    if scheduled?
      @account.scheduled_statuses.find(@idempotency_duplicate)
    else
      @account.statuses.find(@idempotency_duplicate)
    end
  end

  def idempotency_duplicate?
    @idempotency_duplicate = redis.get(idempotency_key)
  end

  def scheduled_in_the_past?
    @scheduled_at.present? && @scheduled_at <= Time.now.utc
  end

  def bump_potential_friendship!
    return if !@status.reply? || @account.id == @status.in_reply_to_account_id

    ActivityTracker.increment('activity:interactions')
  end

  def status_attributes
    {
      text: @text,
      media_attachments: @media || [],
      ordered_media_attachment_ids: (@options[:media_ids] || []).map(&:to_i) & @media.map(&:id),
      thread: @in_reply_to,
      poll_attributes: poll_attributes,
      sensitive: @sensitive,
      spoiler_text: @options[:spoiler_text] || '',
      visibility: @visibility,
      language: valid_locale_cascade(@options[:language], @account.user&.preferred_posting_language, I18n.default_locale),
      application: @options[:application],
      rate_limit: @options[:with_rate_limit],
      quote_approval_policy: @options[:quote_approval_policy],
      post_type: @options[:post_type] || 'normal',
    }.compact
  end

  def scheduled_status_attributes
    {
      scheduled_at: @scheduled_at,
      media_attachments: @media || [],
      params: scheduled_options,
    }
  end

  def poll_attributes
    return if @options[:poll].blank?

    @options[:poll].merge(account: @account, voters_count: 0)
  end

  def scheduled_options
    @options.dup.tap do |options_hash|
      options_hash[:in_reply_to_id]  = options_hash.delete(:thread)&.id
      options_hash[:application_id]  = options_hash.delete(:application)&.id
      options_hash[:quoted_status_id] = options_hash.delete(:quoted_status)&.id
      options_hash[:scheduled_at]    = nil
      options_hash[:idempotency]     = nil
      options_hash[:with_rate_limit] = false
    end
  end
end
