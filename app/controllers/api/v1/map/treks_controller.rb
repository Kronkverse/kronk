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
  # Reaches a trek may be published at (docs/kronk_feed_and_reach.md §2).
  # Defaults to Mates (the personal-korner default, §2.4).
  TREK_REACHES = %w(public orbit mates self_only).freeze

  ACTIVITY_GLYPHS = {
    'run' => '🏃', 'walk' => '🚶', 'hike' => '🥾',
    'swim' => '🏊', 'ride' => '🚴', 'paddle' => '🛶'
  }.freeze

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index, :show]
  before_action :require_user!
  before_action :set_trek,       only: [:show]
  before_action :set_owned_trek, only: [:publish, :unpublish, :destroy]

  def index
    treks = Trek.feed_for(current_account).includes(:account, :status).limit(limit)
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

  # Publishing a trek posts a timeline Status at the author-chosen reach
  # (docs/kronk_feed_and_reach.md §2) and links it via status_id — froth is a
  # Favourite on that Status, comments are replies. Default reach is Mates
  # (the personal-korner default, §2.4).
  def publish
    reach = trek_reach(params[:visibility])
    return render json: { error: 'invalid_visibility' }, status: 422 if reach.nil?

    # Create the status OUTSIDE any transaction. PostStatusService enqueues
    # DistributionWorker via Sidekiq.perform_async, which starts running
    # immediately — before an enclosing transaction would commit. The worker
    # silently swallows ActiveRecord::RecordNotFound, so the fanout to home
    # feeds never runs and the trek is orphaned from every timeline (visible
    # only on the author profile / direct URL). Mirrors the same fix in
    # Api::V1::EventsController#create_status_for_event!.
    if @trek.status_id.blank?
      status = PostStatusService.new.call(
        current_account,
        text: trek_status_body(@trek),
        visibility: reach,
        application: doorkeeper_token&.application
      )
      status.update_column(:source_korner, 'map') # feed projection discriminator (§3.2)
      @trek.update!(status: status, state: :published)
    else
      @trek.update!(state: :published)
    end

    render json: project(@trek)
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  # Unpublishing removes the timeline Status (back to a private draft).
  def unpublish
    ApplicationRecord.transaction do
      status = @trek.status
      @trek.update!(status: nil, state: :draft)
      RemoveStatusService.new.call(status) if status
    end
    render json: project(@trek)
  end

  def destroy
    status = @trek.status
    @trek.destroy!
    RemoveStatusService.new.call(status) if status
    head 204
  end

  private

  # Read path: any trek by id; show re-checks visible_to?(current_account).
  def set_trek
    @trek = Trek.find(params[:id])
  end

  # Write path (publish/unpublish/destroy): scope strictly to the owner, so a
  # non-owner gets 404 instead of being able to delete another user's trek or
  # force-publish their private draft. (The previous `|| Trek.find` fallback
  # defeated the owner scoping entirely.)
  def set_owned_trek
    @trek = Trek.find_by!(id: params[:id], account_id: current_account.id)
  end

  def limit
    [params.fetch(:limit, 40).to_i.abs, 80].min
  end

  def trek_reach(value)
    reach = value.presence || 'mates'
    TREK_REACHES.include?(reach) ? reach : nil
  end

  def trek_status_body(trek)
    glyph = ACTIVITY_GLYPHS[trek.activity_type]
    heading = [glyph, trek.title.presence || trek.activity_type.capitalize].compact.join(' ')
    stat = "#{(trek.distance_m / 1000.0).round(1)} km"
    stat += " · #{trek.moving_sec / 60}m" if trek.moving_sec.to_i.positive?
    "#{heading}\n#{stat}"
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
      status_id: trek.status_id&.to_s,
      # The published post's reach (§2) — comments mirror it so a reply never
      # travels wider than the trek. Null while a draft.
      visibility: trek.status&.visibility,
      self: mine,
    }
  end
end
