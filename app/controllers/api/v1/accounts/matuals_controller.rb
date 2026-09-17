# frozen_string_literal: true

# Kronk — Matuals. The intersection of the viewer's Mates with the
# target account's Mates ("mates in common"; portmanteau of "mates"
# + "mutual"). Powers the Matuals row on the standard profile card.
#
#   GET /api/v1/accounts/:account_id/matuals
#
# Returns a small preview shape rather than the full account list:
#
#   { count: 7,
#     previews: [
#       { id: '123', acct: 'chris', display_name: 'Chris', avatar: '…' },
#       …
#     ] }
#
# The preview is capped at PREVIEW_LIMIT — the card only ever renders a
# handful of avatars + "N more". A dedicated endpoint (rather than
# embedding the count in every AccountSerializer response) keeps the
# common account fetch fast; matuals cost a Mates-of-Mates query.
class Api::V1::Accounts::MatualsController < Api::BaseController
  include RoutingHelper

  PREVIEW_LIMIT = 6

  before_action -> { doorkeeper_authorize! :read, :'read:follows' }
  before_action :require_user!
  before_action :set_target

  def index
    # Rare edge: viewer asking for their own matuals with themselves —
    # answer is empty (you don't share matuals with yourself).
    return render(json: empty_payload) if @target.id == current_account.id

    intersection = current_account.mates.where(id: @target.mates.select(:id))
    count = intersection.count
    previews = intersection.limit(PREVIEW_LIMIT).map { |a| project(a) }

    render json: { count: count, previews: previews }
  end

  private

  def set_target
    @target = Account.find(params[:account_id])
  end

  def project(account)
    {
      id: account.id.to_s,
      acct: account.acct,
      display_name: account.display_name.presence || account.username,
      avatar: full_asset_url(account.avatar_static_url),
    }
  end

  def empty_payload
    { count: 0, previews: [] }
  end
end
