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

  def create
    return render json: { error: 'members only' }, status: 403 unless @krew.member?(current_account)
    return render json: { error: 'krew is archived' }, status: 422 if @krew.archived?

    invited = @krew.invitable_accounts(params[:account_ids], inviter: current_account).map do |account|
      Nudges::Conversation.invite_to_krew!(@krew, account, current_account)
      account.id.to_s
    end

    render json: { invited_account_ids: invited }
  end

  private

  def set_krew
    @krew = Krew.find_by(slug: params[:krew_id]) || Krew.find(params[:krew_id])
  end
end
