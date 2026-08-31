# frozen_string_literal: true

class Api::V2::SearchController < Api::BaseController
  include AsyncRefreshesConcern
  include Authorization

  RESULTS_LIMIT = 20

  # Types the Kronk search adapter is asked to look in for a universal
  # (unscoped) query. Three Mastodon-native + five Kronk-native — the
  # nine that the reindex populates minus `nudge_messages` (DMs; not a
  # universal-search surface).
  UNIVERSAL_KRONK_TYPES = %i(
    accounts statuses kategories
    kalendar_events kommons_proposals booth_sets wachuneed_listings krews
  ).freeze

  # `params[:type]` values the Kronk endpoint accepts for a scoped
  # search. Mastodon's own accounts/statuses/hashtags are handled
  # inline in `requested_types`; this lookup covers the Kronk-native
  # extras exposed via the same param.
  KRONK_TYPE_FROM_PARAM = {
    'events' => :kalendar_events,
    'proposals' => :kommons_proposals,
    'booth_sets' => :booth_sets,
    'listings' => :wachuneed_listings,
    'krews' => :krews,
  }.freeze

  before_action -> { authorize_if_got_token! :read, :'read:search' }
  before_action :validate_search_params!

  with_options unless: :user_signed_in? do
    before_action :query_pagination_error, if: :pagination_requested?
    before_action :remote_resolve_error, if: :remote_resolve_requested?
  end
  before_action :require_valid_pagination_options!
  before_action :handle_fasp_requests

  def index
    @search = kronk_search_active? ? kronk_search_results : Search.new(search_results)
    log_search_query
    # Use the extended Kronk serializer only when we ran the Kronk
    # search path — the upstream `SearchService` path returns a plain
    # `::Search` and the extra Kronk collections would just serialise
    # as empty arrays, adding noise for third-party clients on
    # instances without meilisearch.
    if kronk_search_active?
      render json: @search, serializer: REST::Kronk::SearchSerializer
    else
      render json: @search, serializer: REST::SearchSerializer
    end
  rescue Mastodon::SyntaxError
    unprocessable_content
  rescue ActiveRecord::RecordNotFound
    not_found
  end

  private

  def validate_search_params!
    params.require(:q)
  end

  def query_pagination_error
    render json: { error: 'Search queries pagination is not supported without authentication' }, status: 401
  end

  def remote_resolve_error
    render json: { error: 'Search queries that resolve remote resources are not supported without authentication' }, status: 401
  end

  def handle_fasp_requests
    return unless Mastodon::Feature.fasp_enabled?
    return if params[:q].blank?

    # Do not schedule a new retrieval if the request is a follow-up
    # to an earlier retrieval
    return if request.headers['Mastodon-Async-Refresh-Id'].present?

    refresh_key = "fasp:account_search:#{Digest::MD5.base64digest(params[:q])}"
    return if AsyncRefresh.new(refresh_key).running?

    add_async_refresh_header(AsyncRefresh.create(refresh_key))
    @query_fasp = true
  end

  def remote_resolve_requested?
    truthy_param?(:resolve)
  end

  def pagination_requested?
    params[:offset].present?
  end

  def search_results
    SearchService.new.call(
      params[:q],
      current_account,
      limit_param(RESULTS_LIMIT),
      combined_search_params
    )
  end

  def combined_search_params
    search_params.merge(
      resolve: truthy_param?(:resolve),
      exclude_unreviewed: truthy_param?(:exclude_unreviewed),
      following: truthy_param?(:following),
      query_fasp: @query_fasp
    )
  end

  def search_params
    params.permit(:type, :offset, :min_id, :max_id, :account_id, :following)
  end

  # ── Kronk 2.x search path (Phase 7.3/7.4) ───────────────────────────
  # When SEARCH_BACKEND=meilisearch, hits from `Kronk::Search.adapter`
  # replace the upstream SearchService pipeline. Response shape stays
  # identical (accounts / statuses / hashtags) so clients don't break.
  #
  # Per-type policy filtering runs above the adapter in
  # `Kronk::Search::PolicyFilter` — the index is a superset; the
  # response is a subset gated by the viewer's identity (spec §7).

  def kronk_search_active?
    Kronk::Search.backend == 'meilisearch'
  end

  def kronk_search_results
    types = requested_types
    hits  = types.flat_map { |type| Kronk::Search.adapter.search(type: type, query: params[:q], filters: {}, viewer: current_account) }
    Kronk::Search::PolicyFilter.filter(hits, current_account)
  end

  # Resolve `params[:type]` to the adapter type set. Mastodon-native
  # names (accounts/statuses/hashtags) resolve inline; Kronk-native
  # names go through `KRONK_TYPE_FROM_PARAM`; bare/unknown opens the
  # `UNIVERSAL_KRONK_TYPES` set.
  def requested_types
    scoped = case params[:type].to_s
             when 'accounts' then [:accounts]
             when 'statuses' then [:statuses]
             when 'hashtags' then [:kategories]
             else KRONK_TYPE_FROM_PARAM[params[:type].to_s]&.then { |t| [t] }
             end
    scoped || UNIVERSAL_KRONK_TYPES
  end

  # Aggregate-only logging per spec §"Query logging": never log the
  # query string with an account identifier attached. A single log
  # line per request goes to Rails.logger for capacity + latency
  # tracking; downstream aggregators can count occurrences without
  # ever seeing what the user typed or who typed it.
  def log_search_query
    Rails.logger.info(
      "[kronk:search] backend=#{Kronk::Search.backend} " \
      "type=#{params[:type].presence || 'universal'} " \
      "authenticated=#{user_signed_in? ? 'y' : 'n'}"
    )
  end
end
