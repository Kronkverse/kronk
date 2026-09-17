# frozen_string_literal: true

class Api::V1::Timelines::HomeController < Api::V1::Timelines::BaseController
  include AsyncRefreshesConcern

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

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
    # Kronk::TuneInGate is a no-op unless FeatureFlags.tune_in_enforced is set —
    # keeps the read path unchanged until Phase 14 flips the flag.
    statuses = Kronk::TuneInGate.filter(current_user&.account, preloaded_home_statuses)

    # Defence in depth against fan-out-suppressed post types leaking into
    # the feed via any code path we haven't gated on WRITE (populate_home
    # regen, historic pre-#1681 rows stuck in Redis, etc.). Album photos
    # live on their album's card; kuestion answers live on the question
    # page — neither belongs as a per-item home entry. Mirrors the
    # PostStatusService distribution gate — keep the predicates in sync.
    statuses = statuses.reject { |s| s.kronk_answer? || s.kronk_album_photo? }

    # Audience-scope narrowing (Me / Mates / Orbit). Gated behind
    # feed_scope_enforced so the read path is unchanged until the flag is
    # flipped; orbit and an absent scope pass through untouched.
    return statuses unless Kronk::FeatureFlags.enabled?(:feed_scope_enforced)

    Kronk::AudienceScope.filter_statuses(current_user&.account, statuses, requested_scope)
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

  def preloaded_home_statuses
    preload_collection home_statuses, Status
  end

  def home_statuses
    account_home_feed.get(
      limit_param(DEFAULT_STATUSES_LIMIT),
      params[:max_id],
      params[:since_id],
      params[:min_id]
    )
  end

  def account_home_feed
    HomeFeed.new(current_account)
  end

  def next_path
    api_v1_timelines_home_url next_path_params
  end

  def prev_path
    api_v1_timelines_home_url prev_path_params
  end
end
