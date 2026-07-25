# frozen_string_literal: true

# Map — Treks. Recorded activities; kept private until published to Mates
# (docs/spaces/map.md, Phase 3).
#
#   GET    /api/v1/map/treks           — feed: mine + Mates' published
#   GET    /api/v1/map/treks/:id       — one (owner, or a Mate if published)
#   POST   /api/v1/map/treks           — create a draft (manual or with a route)
#   POST   /api/v1/map/treks/:id/publish   /unpublish
#   DELETE /api/v1/map/treks/:id
#
# The projection never emits anything beyond the already privacy-trimmed
# `route`; the raw start/end is not stored, so there is nothing to leak.
class Api::V1::Map::TreksController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index, :show]
  before_action :require_user!
  before_action :set_trek, only: [:show, :publish, :unpublish, :destroy]

  def index
    treks = Trek.feed_for(current_account).includes(:account).limit(limit)
    render json: treks.map { |t| project(t) }
  end

  def show
    return render json: { error: 'not_found' }, status: 404 unless @trek.visible_to?(current_account)

    render json: project(@trek)
  end

  def create
    trek = Trek.record!(
      current_account,
      activity_type: params.require(:activity_type),
      title: params[:title].to_s,
      recorded_at: params[:recorded_at].presence || Time.now.utc,
      points: params[:points],
      label: params[:label],
      distance_m: params[:distance_m],
      moving_sec: params[:moving_sec],
      pace_seconds: params[:pace_seconds],
      speed_kmh: params[:speed_kmh],
      elevation_gain: params[:elevation_gain]
    )
    render json: project(trek)
  rescue ActionController::ParameterMissing => e
    render json: { error: e.message }, status: 400
  rescue ArgumentError, ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def publish
    @trek.update!(state: :published)
    render json: project(@trek)
  end

  def unpublish
    @trek.update!(state: :draft)
    render json: project(@trek)
  end

  def destroy
    @trek.destroy!
    head 204
  end

  private

  def set_trek
    @trek = Trek.find_by(id: params[:id], account_id: current_account.id) ||
            Trek.find(params[:id])
  end

  def limit
    [params.fetch(:limit, 40).to_i.abs, 80].min
  end

  def project(trek)
    account = trek.account
    mine = account.id == current_account.id

    {
      id: trek.id.to_s,
      account_id: account.id.to_s,
      name: account.display_name.presence || account.username,
      handle: account.acct,
      activity_type: trek.activity_type,
      title: trek.title,
      label: trek.label,
      recorded_at: trek.recorded_at.iso8601,
      distance_m: trek.distance_m,
      moving_sec: trek.moving_sec,
      pace_seconds: trek.pace_seconds,
      speed_kmh: trek.speed_kmh,
      elevation_gain: trek.elevation_gain,
      trimmed_m: trek.trimmed_m,
      has_route: trek.has_route,
      # The stored route is already privacy-trimmed; still, only expose it to
      # someone allowed to see the trek.
      route: trek.visible_to?(current_account) ? trek.route : nil,
      state: trek.state,
      self: mine,
    }
  end
end
