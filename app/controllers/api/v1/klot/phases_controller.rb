# frozen_string_literal: true

# Public projection of another account's cycle phase — the *only* Klot
# endpoint that returns another user's state. Access is strictly gated
# on the target account having added the caller to its allowlist.
#
# Response shape is deliberately narrow — see REST::KlotPhaseSerializer.
class Api::V1::Klot::PhasesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

  def show
    target = Account.find(params[:account_id])

    unless target.klot_shares.where(viewer_account: current_account).exists?
      # 404 rather than 403 so viewer can't tell whether the target
      # is a Klot user at all if they're not in the allowlist.
      raise ActiveRecord::RecordNotFound
    end

    phase = Klot::Phase.for(target)

    render json: {
      account_id: target.id,
      phase: phase,
      as_of: Time.current,
    }, serializer: REST::KlotPhaseSerializer
  end
end
