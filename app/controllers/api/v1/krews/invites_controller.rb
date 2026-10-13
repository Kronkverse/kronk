# frozen_string_literal: true

# Inviting people into a Krew that already exists.
#
#   POST /api/v1/krews/:krew_id/invites   { account_ids: [...] }
#
# Any member can invite, and can invite anyone on Kronk (Tal 2026-10-13).
# An invite is a pending request in the invited person's Nudges, the same
# one Gather a Krew sends: nobody joins without accepting it.
class Api::V1::Krews::InvitesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }
  before_action :require_user!
  before_action :set_krew

  MAX_INVITES = 40

  def create
    return render json: { error: 'members only' }, status: 403 unless @krew.member?(current_account)
    return render json: { error: 'krew is archived' }, status: 422 if @krew.archived?

    invited = invitees.map do |account|
      Nudges::Conversation.invite_to_krew!(@krew, account, current_account)
      account.id.to_s
    end

    render json: { invited_account_ids: invited }
  end

  private

  def set_krew
    @krew = Krew.find_by(slug: params[:krew_id]) || Krew.find(params[:krew_id])
  end

  # Local, not suspended, not the inviter, not already a member, and not
  # someone who has blocked the inviter.
  def invitees
    ids = Array(params[:account_ids]).map(&:to_i).reject(&:zero?).uniq.first(MAX_INVITES) - [current_account.id]
    return [] if ids.empty?

    Account.local.without_suspended.where(id: ids).reject do |account|
      @krew.member?(account) || account.blocking?(current_account)
    end
  end
end
