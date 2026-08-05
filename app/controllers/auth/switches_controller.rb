# frozen_string_literal: true

# Account switcher (server-side multi-session). Lets a signed-in user make one
# of the OTHER accounts they have already authenticated on this browser the
# active one, without logging out. See AccountSwitching for how the set of
# authenticated accounts is stored and why a switch can only ever target an
# account the user genuinely authenticated here.
class Auth::SwitchesController < ApplicationController
  include AccountSwitching

  skip_before_action :require_functional!
  before_action :require_signed_in!

  # GET /auth/accounts — the non-secret roster for the switcher UI.
  def index
    render json: switcher_roster
  end

  # POST /auth/switch { user_id } — activate an already-authenticated account.
  def create
    target = params[:user_id].to_s
    set    = authed_accounts

    # Fail closed: never switch to an id that is not in the server-only set,
    # i.e. one the browser did not actually authenticate.
    return render_switch_error(:unknown_account, :forbidden) unless set.key?(target)

    stored_session_id = set[target]
    user       = User.find_by(id: target)
    activation = user&.session_activations&.find_by(session_id: stored_session_id)

    # Stale entry (password change / remote revoke destroyed the activation):
    # prune it and fail closed to re-authentication rather than switching.
    if user.nil? || activation.nil?
      prune_authed_account(target)
      return render_switch_error(:reauth_required, :unauthorized)
    end

    # Reuse the target's existing activation (no new token minted): set its
    # _session_id first, then sign in.
    write_session_activation_cookie(stored_session_id)
    sign_in(user)
    self.authed_accounts = set # preserve the full set across the switch

    respond_switch(root_path)
  end

  private

  def require_signed_in!
    return if user_signed_in?

    respond_to do |format|
      format.json { render json: { error: 'unauthenticated' }, status: 401 }
      format.all  { redirect_to new_user_session_path }
    end
  end

  def render_switch_error(code, status)
    # The SPA drives switching over JSON and reads the machine `error` code; the
    # HTML branch is only a non-JS fallback, so it just bounces to sign-in.
    respond_to do |format|
      format.json { render json: { error: code.to_s }, status: status }
      format.all  { redirect_to new_user_session_path }
    end
  end
end
