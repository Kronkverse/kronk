# frozen_string_literal: true

# A pass into one of Kronk's calls (docs/decisions.md, 2026-10-27, "Kronk's
# own Jitsi").
#
#   POST /api/v1/calls/token  { kind: 'huddle' | 'kuddle' | 'booth_live', id? }
#     -> { domain, room, jwt, moderator, recording }
#
# `room` is the Jitsi room name (JITSI_ROOM_PREFIX included); `jwt` is null
# when the server takes no tokens (no JITSI_JWT_SECRET). `moderator` says the
# pass makes you one, `recording` whether this Kronk can keep a recording, so
# the client shows Record only when both hold. Someone who can't see the call
# gets a 404, as for the call itself; one who can see a live set that isn't
# live yet gets a 403.
class Api::V1::Calls::TokensController < Api::BaseController
  include RoutingHelper

  before_action -> { doorkeeper_authorize! :read }
  before_action :require_user!

  def create
    target = Kronk::CallTarget.find!(params[:kind], params[:id])
    raise ActiveRecord::RecordNotFound unless target.visible_to?(current_account)
    raise Mastodon::NotPermittedError unless target.joinable_by?(current_account)

    moderator = target.moderator?(current_account)
    response.headers['Cache-Control'] = 'private, no-store'
    render json: {
      domain: Kronk::Jitsi.domain,
      room: target.room_name,
      jwt: Kronk::Jitsi.pass(account: current_account, room: target.room_name, moderator: moderator, avatar: avatar_url),
      moderator: moderator,
      recording: Kronk::Jitsi.recording?,
    }
  end

  private

  def avatar_url
    full_asset_url(current_account.avatar_original_url)
  rescue ArgumentError, URI::Error
    nil
  end
end
