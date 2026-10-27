# frozen_string_literal: true

# The crowd on screen in a live set (docs/spaces/booth.md): shoutouts,
# reactions, track requests and the host's Now playing.
#
#   GET    /api/v1/booth_lives/:booth_live_id/moments?since_id=
#          -> [moment, …] oldest first: the ones after `since_id`, up to 100,
#             or without it the latest 50. The room polls this every few
#             seconds while it's live.
#   POST   /api/v1/booth_lives/:booth_live_id/moments
#          { kind: shoutout|request, body } · { kind: reaction, body: froth|applause|rewind }
#          · { kind: track, body: "Artist - Title" } (the host only)
#          -> the moment. 422 when the set isn't live, 429 a second time
#             within BoothLiveMoment::THROTTLE.
#   DELETE /api/v1/booth_live_moments/:id  (its author, the host, a steward)
#
# Out of the set's reach (BoothLive#visible_to?), the set isn't there: 404.
class Api::V1::BoothLiveMomentsController < Api::BaseController
  LIMIT = 100
  FIRST_LOAD = 50

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index]
  before_action :require_user!
  before_action :set_booth_live, only: [:index, :create]

  def index
    scope = @booth_live.moments.includes(:account, :booth_live)
    moments = if params[:since_id].present?
                scope.where(id: (params[:since_id].to_i + 1)..).order(:id).limit(LIMIT)
              else
                scope.order(id: :desc).limit(FIRST_LOAD).reverse
              end
    response.headers['Cache-Control'] = 'private, no-store'
    render json: moments, each_serializer: REST::BoothLiveMomentSerializer
  end

  def create
    kind = params[:kind].to_s
    return render json: { error: 'Unknown kind' }, status: 422 unless BoothLiveMoment::KINDS.include?(kind)
    raise Mastodon::NotPermittedError if kind == 'track' && !host?
    return render json: { error: 'This set is not live' }, status: 422 unless @booth_live.live?
    return render json: { error: 'Slow down a little' }, status: 429 if BoothLiveMoment.too_soon?(@booth_live, current_account)

    moment = @booth_live.moments.new(account: current_account, kind: kind)
    if kind == 'track'
      moment.track_text = params[:body]
    else
      moment.body = params[:body].to_s.strip
    end
    moment.save!

    render json: moment, serializer: REST::BoothLiveMomentSerializer
  end

  def destroy
    moment = BoothLiveMoment.find(params[:id])
    raise ActiveRecord::RecordNotFound unless moment.booth_live.visible_to?(current_account)
    raise Mastodon::NotPermittedError unless removable?(moment)

    moment.destroy!
    render_empty
  end

  private

  def set_booth_live
    @booth_live = BoothLive.find(params[:booth_live_id])
    raise ActiveRecord::RecordNotFound unless @booth_live.visible_to?(current_account)
  end

  def host?
    @booth_live.account_id == current_account.id
  end

  def removable?(moment)
    [moment.account_id, moment.booth_live.account_id].include?(current_account.id) ||
      current_user.role&.can?(:manage_reports)
  end
end
