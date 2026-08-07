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

    # Audience-scope narrowing (Me / Mates / Orbit). Gated behind
    # feed_scope_enforced so the read path is unchanged until the flag is
    # flipped; orbit and an absent scope pass through untouched.
    return statuses unless Kronk::FeatureFlags.enabled?(:feed_scope_enforced)

    Kronk::AudienceScope.filter_statuses(current_user&.account, statuses, requested_scope)
  end

  # The requested audience tier: the explicit `scope` param wins (the frontend
  # fetches each scope into its own timeline), falling back to the viewer's
  # persisted feed_scope setting, then orbit.
  def requested_scope
    params[:scope].presence || current_user&.settings&.[]('kronk.feed_scope') || 'orbit'
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
