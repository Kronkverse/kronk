# frozen_string_literal: true

class Api::V1::Timelines::HomeController < Api::V1::Timelines::BaseController
  include AsyncRefreshesConcern

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

  # Pagination follows the raw read, not the filtered survivors
  # (Kronk::FilteredFeedPage) — so a page the filters emptied still has a
  # next link, instead of ending the feed.
  skip_after_action :insert_pagination_headers
  after_action :insert_pagination_headers, if: -> { @page&.read_any? }

  PERMITTED_PARAMS = %i(local limit scope).freeze

  def show
    with_read_replica do
      @statuses = load_statuses
      @relationships = StatusRelationshipsPresenter.new(@statuses, current_user&.account_id)
    end

    add_async_refresh_header(account_home_feed.async_refresh, retry_seconds: 5)

    render json: @statuses,
           each_serializer: REST::StatusSerializer,
           relationships: @relationships,
           status: account_home_feed.regenerating? ? 206 : 200
  end

  private

  def load_statuses
    @page = Kronk::FilteredFeedPage.new(
      limit: limit_param(DEFAULT_STATUSES_LIMIT),
      max_id: params[:max_id],
      since_id: params[:since_id],
      min_id: params[:min_id],
      read: method(:read_statuses),
      filter: method(:filter_statuses)
    )
    @page.statuses
  end

  def filter_statuses(statuses)
    # Kronk::TuneInGate is a no-op unless FeatureFlags.tune_in_enforced is set —
    # keeps the read path unchanged until Phase 14 flips the flag.
    statuses = Kronk::TuneInGate.filter(current_user&.account, statuses)

    # Defence in depth against fan-out-suppressed post types leaking into
    # the feed via any code path we haven't gated on WRITE (populate_home
    # regen, historic pre-#1681 rows stuck in Redis, etc.). Album photos
    # live on their album's card; kuestion answers live on the question
    # page, Moments in the Home strip — none belongs as a per-item home
    # entry. Same predicate as the PostStatusService distribution gate.
    statuses = statuses.reject(&:kronk_feed_suppressed?)

    # Audience-scope narrowing (Me / Mates / Orbit). Gated behind
    # feed_scope_enforced so the read path is unchanged until the flag is
    # flipped; orbit and an absent scope pass through untouched.
    return statuses unless scope_enforced?

    Kronk::AudienceScope.filter_statuses(current_user&.account, statuses, requested_scope)
  end

  # Me reads the viewer's own posts from the database: the home feed only
  # keeps the latest FeedManager::MAX_ITEMS entries from everyone, so own
  # posts older than that window never reached the Me tier at all. Same rules
  # as the home feed: no replies, and Just me posts reach no feed.
  def read_statuses(max_id, since_id, min_id)
    limit = limit_param(DEFAULT_STATUSES_LIMIT)

    if scope_enforced? && requested_scope == 'me'
      preload_collection_paginated_by_id(
        current_account.statuses.without_replies.where.not(visibility: %i(direct self_only)),
        Status,
        limit,
        max_id: max_id, since_id: since_id, min_id: min_id
      )
    else
      preload_collection account_home_feed.get(limit, max_id, since_id, min_id), Status
    end
  end

  def scope_enforced?
    Kronk::FeatureFlags.enabled?(:feed_scope_enforced)
  end

  # The requested audience tier comes from the explicit `scope` param — the
  # frontend fetches each tier into its own timeline (home:mates / home:me) and
  # leaves the Orbit tab paramless. An absent param means Orbit (the full home
  # graph): we deliberately do NOT fall back to the persisted feed_scope setting,
  # or the paramless Orbit tab would be narrowed for anyone whose saved scope is
  # Mates/Me.
  def requested_scope
    params[:scope].presence || 'orbit'
  end

  def account_home_feed
    HomeFeed.new(current_account)
  end

  def pagination_max_id
    @page.next_max_id
  end

  def pagination_since_id
    @page.prev_min_id
  end

  def next_path
    api_v1_timelines_home_url next_path_params
  end

  def prev_path
    api_v1_timelines_home_url prev_path_params
  end
end
