# frozen_string_literal: true

# Live location from Anthemos (docs/spaces/map.md, Live location).
#
#   GET    /api/v1/map/live            — live Mates sharing with me, latest point
#   GET    /api/v1/map/live/mine       — my shares running now
#   POST   /api/v1/map/live            — start one (signed by a linked phone)
#   PUT    /api/v1/map/live/:id/point  — the phone's latest point (signed)
#   DELETE /api/v1/map/live/:id        — stop it; the point goes at once
#
# Exact, unlike a pin, because the person chose who sees it and for how long,
# from a phone whose key signs every point. What the phone signs:
#   start: "anthemos-share-v1\n<link id>\n<recipient ids, sorted, comma-joined>\n<expires_at, epoch seconds>"
#   point: "anthemos-live-v1\n<share id>\n<lat>\n<lng>\n<accuracy>\n<at, epoch seconds>"
# with each value exactly as sent. As with presence, `index` builds every row
# by hand so it can't say more than it means to.
class Api::V1::Map::LiveController < Api::BaseController
  include RoutingHelper

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :mine]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :point, :destroy]
  before_action :require_user!

  def index
    shares = LiveShare.shared_with(current_account)
                      .where(account_id: current_account.mates.select(:id))
                      .includes(:account)
    render json: shares.filter_map { |share| (point = share.point) && project(share, point) }
  end

  def mine
    render json: own_shares.active.order(:expires_at).map { |share| project_own(share) }
  end

  def create
    link = AnthemosLink.find_by!(account: current_account, id: params.require(:link_id))
    ids = Array(params.require(:recipient_ids)).map { |id| Integer(id.to_s, 10) }.uniq.sort
    expires = params.require(:expires_at).to_s
    return render(json: { error: 'bad_signature' }, status: 422) unless link.verify?(params.require(:signature), 'anthemos-share-v1', link.id, ids.join(','), expires)

    share = LiveShare.create!(account: current_account, anthemos_link: link,
                              recipient_account_ids: ids, expires_at: Time.zone.at(Integer(expires, 10)))
    link.touch(:last_used_at)
    ids.each do |id|
      Kronk::KornerEvents.publish('map.live.started', actor_account_id: current_account.id, recipient_account_id: id)
    end
    render json: project_own(share)
  rescue ActionController::ParameterMissing => e
    render json: { error: e.message }, status: 400
  rescue ArgumentError => e
    render json: { error: e.message }, status: 422
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: 422
  end

  def point
    share = own_shares.find(params[:id])
    return render(json: { error: 'ended' }, status: 410) unless share.active?

    sent = %i(lat lng accuracy at).map { |key| params.require(key).to_s }
    return render(json: { error: 'bad_signature' }, status: 422) unless share.anthemos_link.verify?(params.require(:signature), 'anthemos-live-v1', share.id, *sent)

    lat, lng, accuracy, at = sent
    share.place!(lat: Float(lat), lng: Float(lng), accuracy: Float(accuracy).round, at: Time.zone.at(Integer(at, 10)))
    share.anthemos_link.touch(:last_used_at)
    head 204
  rescue ActionController::ParameterMissing => e
    render json: { error: e.message }, status: 400
  rescue ArgumentError => e
    render json: { error: e.message }, status: 422
  end

  def destroy
    own_shares.find(params[:id]).stop!
    head 204
  end

  private

  def own_shares
    LiveShare.where(account: current_account)
  end

  def person(account)
    {
      account_id: account.id.to_s,
      name: account.display_name.presence || account.username,
      handle: account.acct,
      avatar: full_asset_url(account.avatar_static_url),
    }
  end

  def project(share, point)
    person(share.account).merge(
      id: share.id.to_s,
      lat: point[:lat],
      lng: point[:lng],
      accuracy: point[:accuracy],
      at: Time.zone.at(point[:at]).iso8601,
      expires_at: share.expires_at.iso8601,
      # Every point is checked against the phone's key before it is kept.
      signed: true
    )
  end

  def project_own(share)
    {
      id: share.id.to_s,
      link_id: share.anthemos_link_id.to_s,
      device_name: share.anthemos_link.device_name,
      recipients: share.recipients.map { |account| person(account) },
      expires_at: share.expires_at.iso8601,
    }
  end
end
