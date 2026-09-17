# frozen_string_literal: true

# Kronk Account & Security — signed-in devices. Lists the current user's own
# session activations and revokes one. Strictly scoped to `current_user`: a
# user can only ever see and end their own sessions (the `find` below runs on
# `current_user.session_activations`, so someone else's id 404s). The device
# this request came in on is flagged `current` and cannot be revoked here — it
# has no button in the UI, and the guard below refuses it server-side too, so
# a hand-rolled request can't sign the user out from under themselves.
class Api::V1::Settings::SessionsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:destroy]
  before_action :require_user!

  def index
    sessions = current_user.session_activations.order(updated_at: :desc)
    render json: sessions,
           each_serializer: REST::SessionActivationSerializer,
           current_token_id: doorkeeper_token&.id
  end

  def destroy
    session = current_user.session_activations.find(params[:id])

    return render json: { error: 'Cannot revoke the current session' }, status: 422 if session.access_token_id == doorkeeper_token&.id

    session.destroy!
    render json: {}
  end
end
