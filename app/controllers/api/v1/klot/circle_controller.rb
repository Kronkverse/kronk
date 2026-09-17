# frozen_string_literal: true

# Klot — inbound circle. The people currently sharing their phase with
# the caller. **This endpoint IS the privacy contract**: it must be
# structurally incapable of returning anything beneath `phase`. Field
# assembly here goes phase → account handle → nothing else. The
# serializer is deliberately explicit and does not `include :account`
# — the returned record is a plain hash keyed to a small set.
#
#   GET  /api/v1/klot/circle → [{ account_id, name, handle, phase }]
class Api::V1::Klot::CircleController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!

  def index
    shares = PhaseShare.inbound_to(current_account).includes(:sharer)

    entries = shares.map do |share|
      sharer = share.sharer
      profile = CycleProfile.find_by(account_id: sharer.id)
      recent  = CycleLog.most_recent_for(sharer)
      derived = Kronk::CyclePhase.derive(
        cycle_length: profile&.cycle_length || CycleProfile.new.cycle_length,
        period_length: profile&.period_length || CycleProfile.new.period_length,
        most_recent_start: recent&.started_on
      )

      {
        account_id: sharer.id.to_s,
        name: sharer.display_name.presence || sharer.username,
        handle: sharer.acct,
        phase: derived[:phase],
      }
    end

    render json: entries
  end
end
