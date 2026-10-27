# frozen_string_literal: true

# Krew-scoped timeline + composer per §Krews.4.
#
#   GET  /api/v1/krews/:krew_id/statuses
#     Returns statuses targeted at this krew via the statuses_krews
#     join, most recent first, that the viewer may see (StatusPolicy).
#     Signed in only. Standard cursor pagination: max_id for older,
#     since_id / min_id for newer, and a `Link: rel=next` header while
#     there may be more, so the Krew page's feed (StatusList) can load more.
#
#   POST /api/v1/krews/:krew_id/statuses
#     Composes a new Status via PostStatusService and joins it to this
#     krew. Members only. Requires write:statuses.
class Api::V1::Krews::StatusesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create]
  before_action :set_krew
  before_action :require_user!

  DEFAULT_LIMIT = 20
  # How many pages of candidates to look through for a page the viewer may
  # see, before answering with what was found.
  MAX_SCANS = 5

  def index
    scope = @krew.statuses.reorder(id: :desc).includes(:account)
    newer_than = params[:since_id].presence || params[:min_id].presence
    scope = scope.where(Status.arel_table[:id].gt(newer_than)) if newer_than

    statuses = visible_page(scope)
    set_pagination_headers(next_path)

    render json: statuses,
           each_serializer: REST::StatusSerializer,
           relationships: StatusRelationshipsPresenter.new(@statuses, current_user.account_id)
  end

  def create
    return render json: { error: 'members only' }, status: 403 unless @krew.member?(current_account)
    return render json: { error: 'krew is archived' }, status: 422 if @krew.archived?

    status = PostStatusService.new.call(
      current_account,
      text: status_params[:status],
      visibility: status_params[:visibility] || 'public',
      sensitive: status_params[:sensitive],
      spoiler_text: status_params[:spoiler_text],
      application: doorkeeper_token.application,
      with_rate_limit: true
    )

    ActiveRecord::Base.transaction do
      @krew.statuses << status unless @krew.statuses.exists?(id: status.id)
    end

    Kronk::KornerEvents.publish(
      'krew.post.created',
      krew_id: @krew.id,
      status_id: status.id,
      account_id: status.account_id
    )

    render json: status, serializer: REST::StatusSerializer
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  private

  # A Krew's posts carry their own reach (often Just me or Mates, with the
  # Krew on top), so each one goes through StatusPolicy: members see them
  # through the Krew, anyone else only what they could see anyway. Filtering
  # happens after the query, so keep reading older candidates until the page
  # is full: otherwise a run of posts the viewer can't see empties the feed.
  def visible_page(scope)
    limit = limit_param(DEFAULT_LIMIT)
    max_id = params[:max_id].presence
    @statuses = []
    @next_max_id = nil

    MAX_SCANS.times do
      batch = (max_id ? scope.where(Status.arel_table[:id].lt(max_id)) : scope).limit(limit).to_a
      @statuses.concat(batch.select { |status| StatusPolicy.new(current_account, status).show? })
      # A full batch means there may be older candidates.
      @next_max_id = batch.size < limit ? nil : batch.last.id
      break if @next_max_id.nil? || @statuses.size >= limit

      max_id = @next_max_id
    end

    # A full page: the next one starts after its last post.
    if @statuses.size > limit || (@statuses.size == limit && @next_max_id)
      @statuses = @statuses.first(limit)
      @next_max_id = @statuses.last.id
    end

    @statuses
  end

  def next_path
    return if @next_max_id.nil?

    api_v1_krew_statuses_url(params[:krew_id], pagination_params(max_id: @next_max_id))
  end

  # Accept slug or numeric id — mirrors Api::V1::KrewsController#set_krew.
  # The SPA routes at /hub/krew/:id use the slug, so the mini-feed hits
  # `/api/v1/krews/testers/statuses`; without slug support it 404'd and the
  # frontend swallowed the error, leaving the feed empty (2026-09-04).
  # `Krew::SLUG_PATTERN` requires a leading letter — a numeric id can never
  # collide with a slug at the format level.
  def set_krew
    @krew = Krew.find_by(slug: params[:krew_id]) || Krew.find(params[:krew_id])
  end

  def status_params
    params.permit(:status, :visibility, :sensitive, :spoiler_text)
  end
end
