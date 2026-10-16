# frozen_string_literal: true

# POST /api/v1/space_invites
#
# Invite a Mate to come and look at a page of a space (Kommons
# #117431380139828179, "Share and Invite"). It only tells them: a
# notification with your name that opens the page. Nothing about who may
# see or do what changes, so they see whatever the page already lets them.
#
#   params: account_id, path ("/hub/albutts/albums/12")
#
# Mates only, and once a day per person per page.
class Api::V1::SpaceInvitesController < Api::BaseController
  include Redisable

  PATH_RE     = %r{\A/hub/([a-z0-9-]+)(/[A-Za-z0-9_\-./]*)?\z}
  EVERY       = 1.day
  MAX_PATH    = 300

  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!

  def create
    recipient = Account.local.find_by(id: params[:account_id])
    path      = params[:path].to_s
    korner    = Kronk::KornerRegistry.find(path[PATH_RE, 1]) if path.length <= MAX_PATH

    return render json: { error: 'not_a_space_page' }, status: 422 if korner.nil? || path.split('/').include?('..')
    return render json: { error: 'not_mates' }, status: 403 unless recipient && current_account.mate?(recipient)

    if redis.set(key_for(recipient, path), Time.now.utc.to_i, nx: true, ex: EVERY.to_i)
      Nudges::EventRouter.deliver(
        actor: current_account,
        recipient: recipient,
        source_korner_slug: korner.slug,
        verb: 'invited',
        interaction: 'interactive',
        cta_label: "Open #{korner.name}",
        cta_route: path,
        directed: true
      )
    end

    render json: { invited: true }
  end

  private

  def key_for(recipient, path)
    "space_invite:#{current_account.id}:#{recipient.id}:#{Digest::SHA256.hexdigest(path)[0, 16]}"
  end
end
