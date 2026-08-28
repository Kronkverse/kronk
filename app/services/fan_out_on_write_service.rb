# frozen_string_literal: true

class FanOutOnWriteService < BaseService
  include Redisable

  # Push a status into home and mentions feeds
  # @param [Status] status
  # @param [Hash] options
  # @option options [Boolean] update
  # @option options [Array<Integer>] silenced_account_ids
  # @option options [Boolean] skip_notifications
  def call(status, options = {})
    @status    = status
    @account   = status.account
    @options   = options

    return if @status.proper.account.suspended?

    check_race_condition!
    warm_payload_cache!

    fan_out_to_local_recipients!
    fan_out_to_public_recipients! if broadcastable?
    fan_out_to_public_streams! if broadcastable?
  end

  private

  def check_race_condition!
    # I don't know why but at some point we had an issue where
    # this service was being executed with status objects
    # that had a null visibility - which should not be possible
    # since the column in the database is not nullable.
    #
    # This check re-queues the service to be run at a later time
    # with the full object, if something like it occurs

    raise Mastodon::RaceConditionError if @status.visibility.nil?
  end

  def fan_out_to_local_recipients!
    # `self_only` is the strictest tier on the reach ladder
    # (docs/kronk_feed_and_reach.md §2, tightened 2026-07-29): the
    # Status lives on the author's own profile timeline (via the
    # AccountStatusesFilter's `author?` branch), but it does NOT
    # enter ANY feed — not the author's home, not any mate's home,
    # not any hashtag or public stream. It also does not fire mention
    # or quote notifications, because the target audience is one
    # account (the author), and the recipient would 403 on click.
    #
    # A self_only status that ALSO targets a Krew is not audience-empty:
    # krew is an additive axis (docs/rebuild/krew_axis_migration.md), so it
    # has a real audience (author + krew members). Such a post behaves like
    # the old `krew` visibility did — it lands in the author's own home and
    # fires its notifications. `radiates_to_no_one?` captures that.
    deliver_to_self! unless radiates_to_no_one?

    unless @options[:skip_notifications] || radiates_to_no_one?
      notify_quoted_account!
      notify_mentioned_accounts!
      notify_about_update! if update?
    end

    case @status.visibility.to_sym
    when :public, :unlisted, :private
      deliver_to_all_followers!
      deliver_to_lists!
    when :mates, :orbit
      # Kronk reach ladder (docs/kronk_feed_and_reach.md §2) — push to the
      # author's Mates' home feeds. `orbit` also *reads* out to mates-of-
      # mates (StatusPolicy#in_author_orbit?), but the proactive FoF home
      # push is deferred (§6 flags its cost); FoF see orbit posts on read.
      deliver_to_mates!
    when :self_only
      # No reach-tier fan-out. See the comment on `deliver_to_self!` above.
      nil
    when :limited
      deliver_to_mentioned_followers!
    else
      deliver_to_mentioned_followers!
      deliver_to_conversation!
    end

    # Krew is an additive audience axis (KRONK_KREWS §3,
    # docs/rebuild/krew_axis_migration.md): independently of the reach tier
    # above, push to the Home feed of every local member across the Krews
    # this status targets. deliver_to_krew_members! is a cheap no-op when
    # the status targets none, dedupes, and skips the author — so it is safe
    # to run alongside any tier (a mate who is also a krew member just gets
    # one idempotent home insert).
    deliver_to_krew_members!

    # Per-post audience, add side (docs/rebuild/per_post_audience.md):
    # independently of the reach tier, push to the Home feed of every local
    # account the author explicitly added to this post. No-op when there are
    # none; skips the author. Removed accounts are handled inside
    # deliver_to_mates! (they're subtracted from the mate push).
    deliver_to_audience_grants!
  end

  def fan_out_to_public_recipients!
    deliver_to_hashtag_followers!
  end

  def fan_out_to_public_streams!
    broadcast_to_hashtag_streams!
    broadcast_to_public_streams!
  end

  def deliver_to_self!
    FeedManager.instance.push_to_home(@account, @status, update: update?) if @account.local? && !@status.reply?
  end

  def notify_quoted_account!
    return unless @status.quote&.quoted_account&.local? && @status.quote&.accepted?

    LocalNotificationWorker.perform_async(@status.quote.quoted_account_id, @status.quote.id, 'Quote', 'quote')
  end

  def notify_mentioned_accounts!
    @status.active_mentions.where.not(id: @options[:silenced_account_ids] || []).joins(:account).merge(Account.local).select(:id, :account_id).reorder(nil).find_in_batches do |mentions|
      LocalNotificationWorker.push_bulk(mentions) do |mention|
        [mention.account_id, mention.id, 'Mention', 'mention']
      end

      # Also land the mention as a Tier-1 "directed at U" nudge on
      # the pair's Mate conversation, so it surfaces in the Nudges
      # messenger (the classic /notifications column redirects to
      # /nudges — a mention that ONLY created a classic Notification
      # record is invisible to the recipient). The router bypasses
      # the Mate gate for directed events per
      # docs/kronk_nudges.md § Relevance engine Tier 1.
      route_mention_nudges(mentions) unless update?

      next unless update?

      # This may result in duplicate update payloads, but this ensures clients
      # are aware of edits to posts only appearing in mention notifications
      # (e.g. private mentions or mentions by people they do not follow)
      PushUpdateWorker.push_bulk(mentions.filter { |mention| subscribed_to_streaming_api?(mention.account_id) }) do |mention|
        [mention.account_id, @status.id, "timeline:#{mention.account_id}:notifications", { 'update' => true }]
      end
    end
  end

  # Fire a Nudges::EventRouter delivery for each fresh mention so the
  # recipient's messenger picks up "@X mentioned you". Skipped on the
  # edit / update path — a re-mention on an update shouldn't double up.
  def route_mention_nudges(mentions)
    actor = @account
    mentions.each do |mention|
      recipient = Account.find_by(id: mention.account_id)
      next if recipient.nil? || recipient.id == actor.id

      Nudges::EventRouter.deliver(
        actor: actor,
        recipient: recipient,
        source_korner_slug: 'nudges',
        verb: 'mention',
        source_type: 'Status',
        source_id: @status.id,
        interaction: 'interactive',
        cta_label: 'Open',
        cta_route: "/@#{actor.username}/#{@status.id}",
        directed: true
      )
    end
  end

  def notify_about_update!
    @status.reblogged_by_accounts.merge(Account.local).select(:id).reorder(nil).find_in_batches do |accounts|
      LocalNotificationWorker.push_bulk(accounts) do |account|
        [account.id, @status.id, 'Status', 'update']
      end
    end

    @status.quotes.accepted.find_in_batches do |quotes|
      LocalNotificationWorker.push_bulk(quotes) do |quote|
        [quote.account_id, quote.status_id, 'Status', 'quoted_update']
      end
    end
  end

  def deliver_to_all_followers!
    @account.followers_for_local_distribution.select(:id).reorder(nil).find_in_batches do |followers|
      FeedInsertWorker.push_bulk(followers) do |follower|
        [@status.id, follower.id, 'home', { 'update' => update? }]
      end
    end
  end

  # Kronk reach — pushes to the Home feed of every local Mate (mutual
  # connection). Excludes the author (deliver_to_self! handled them) and
  # remote accounts (these scopes are local-only, like krew).
  def deliver_to_mates!
    # Per-post audience, remove side (docs/rebuild/per_post_audience.md):
    # subtract any accounts the author explicitly removed from this post, so a
    # removed mate never gets the home insert. StatusPolicy enforces the same
    # exclusion on non-feed reads.
    scope = @account.mates.merge(Account.local).where.not(id: @account.id)
    scope = scope.where.not(id: excluded_account_ids) if excluded_account_ids.any?

    scope.select(:id).reorder(nil).find_in_batches do |mates|
      FeedInsertWorker.push_bulk(mates) do |mate|
        [@status.id, mate.id, 'home', { 'update' => update? }]
      end
    end
  end

  # Per-post audience, add side — home inserts for every local account the
  # author explicitly added, excluding the author (already handled by
  # deliver_to_self!). Idempotent alongside the reach/krew pushes.
  def deliver_to_audience_grants!
    @status.granted_accounts.merge(Account.local).where.not(id: @account.id).select(:id).reorder(nil).find_in_batches do |accounts|
      FeedInsertWorker.push_bulk(accounts) do |account|
        [@status.id, account.id, 'home', { 'update' => update? }]
      end
    end
  end

  def excluded_account_ids
    @excluded_account_ids ||= @status.excluded_accounts.pluck(:id)
  end

  def deliver_to_hashtag_followers!
    TagFollow.for_local_distribution.where(tag_id: @status.tags.map(&:id)).select(:id, :account_id).reorder(nil).find_in_batches do |follows|
      FeedInsertWorker.push_bulk(follows) do |follow|
        [@status.id, follow.account_id, 'tags', { 'update' => update? }]
      end
    end
  end

  def deliver_to_lists!
    @account.lists_for_local_distribution.select(:id).reorder(nil).find_in_batches do |lists|
      FeedInsertWorker.push_bulk(lists) do |list|
        [@status.id, list.id, 'list', { 'update' => update? }]
      end
    end
  end

  def deliver_to_mentioned_followers!
    @status.mentions.joins(:account).merge(@account.followers_for_local_distribution).select(:id, :account_id).reorder(nil).find_in_batches do |mentions|
      FeedInsertWorker.push_bulk(mentions) do |mention|
        [@status.id, mention.account_id, 'home', { 'update' => update? }]
      end
    end
  end

  # Krew audience per KRONK_KREWS §3 — pushes to the Home feed of every
  # local member across all targeted Krews, deduplicated. Excludes the
  # author (deliver_to_self! already handled them) and any account
  # that isn't local (federation for krew visibility is deferred).
  def deliver_to_krew_members!
    krew_ids = @status.krews.pluck(:id)
    return if krew_ids.empty?

    KrewMembership
      .where(krew_id: krew_ids)
      .where.not(account_id: @account.id)
      .joins(:account)
      .merge(Account.local)
      .distinct
      .select(:account_id)
      .reorder(nil)
      .find_in_batches do |batch|
        FeedInsertWorker.push_bulk(batch) do |membership|
          [@status.id, membership.account_id, 'home', { 'update' => update? }]
        end
      end
  end

  def broadcast_to_hashtag_streams!
    @status.tags.map(&:name).each do |hashtag|
      redis.publish("timeline:hashtag:#{hashtag.downcase}", anonymous_payload)
      redis.publish("timeline:hashtag:#{hashtag.downcase}:local", anonymous_payload) if @status.local?
    end
  end

  def broadcast_to_public_streams!
    return if @status.reply?

    redis.publish('timeline:public', anonymous_payload)
    redis.publish(@status.local? ? 'timeline:public:local' : 'timeline:public:remote', anonymous_payload)

    if @status.with_media?
      redis.publish('timeline:public:media', anonymous_payload)
      redis.publish(@status.local? ? 'timeline:public:local:media' : 'timeline:public:remote:media', anonymous_payload)
    end
  end

  def deliver_to_conversation!
    AccountConversation.add_status(@account, @status) unless update?
  end

  def warm_payload_cache!
    Rails.cache.write("fan-out/#{@status.id}", rendered_status)
  end

  def anonymous_payload
    @anonymous_payload ||= Oj.dump(
      event: update? ? :'status.update' : :update,
      payload: rendered_status
    )
  end

  def rendered_status
    @rendered_status ||= InlineRenderer.render(@status, nil, :status)
  end

  def update?
    @options[:update]
  end

  # True when a status reaches nobody but the author: self_only reach AND
  # no additive krew targeting. A self_only post that targets a krew has a
  # real audience (the krew's members), so it does NOT radiate to no one.
  def radiates_to_no_one?
    @status.self_only_visibility? && !targets_krew?
  end

  def targets_krew?
    return @targets_krew if defined?(@targets_krew)

    @targets_krew = @status.krews.exists?
  end

  def broadcastable?
    @status.public_visibility? && !@status.reblog? && !@account.silenced?
  end

  def subscribed_to_streaming_api?(account_id)
    redis.exists?("subscribed:timeline:#{account_id}") || redis.exists?("subscribed:timeline:#{account_id}:notifications")
  end
end
