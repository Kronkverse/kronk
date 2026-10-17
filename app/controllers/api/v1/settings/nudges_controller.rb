# frozen_string_literal: true

# Nudges preferences: which kinds of nudge reach the user.
# docs/spaces/nudges.md (Nudge settings).
#
#   GET /api/v1/settings/nudges  => {
#     types: [{ key, korner, korner_name, label, muted, interactive }, ...],
#     muted_types: [...]
#   }
#   PUT /api/v1/settings/nudges  body: { muted_types: [...] }
#
# The rows come from Nudges::MuteCatalogue, which builds them from what is
# actually delivered, so each key is the one the delivery paths check
# (`Nudges::EventRouter`, `NotifyService`, `Kronk::KornerNotifier`).
# `korner: nil` rows are the "People" group.
class Api::V1::Settings::NudgesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  def show
    render json: payload
  end

  def update
    known = Nudges::MuteCatalogue.keys.to_set
    incoming = Array(params[:muted_types]).map(&:to_s).uniq

    current_user.settings[Nudges::MuteCatalogue::SETTING] = incoming.select { |k| known.include?(k) }
    current_user.save!
    render json: payload
  end

  private

  def payload
    muted = Nudges::MuteCatalogue.muted_keys(current_user)
    types = Nudges::MuteCatalogue.rows(muted: muted.to_set)
    known = types.pluck(:key).to_set
    { types: types, muted_types: muted.select { |k| known.include?(k) } }
  end
end
