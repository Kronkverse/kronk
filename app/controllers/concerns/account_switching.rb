# frozen_string_literal: true

# Server-side account switcher — shared helpers.
#
# The set of accounts a browser has authenticated lives ONLY in the encrypted,
# HttpOnly Rails session cookie:
#
#   session[:authed_accounts] = { user_id.to_s => session_activation.session_id }
#
# It is never exposed to JavaScript (the SPA only ever sees the ACTIVE account's
# token, exactly as before). The only thing that populates it is a full
# authentication on this browser (Auth::SessionsController#on_authentication_success),
# so a switch can only ever target an account the user actually signed into here
# — you can never "become" an account you did not authenticate.
module AccountSwitching
  extend ActiveSupport::Concern

  # How many accounts one browser may hold signed in at once (MVP).
  MAX_SWITCHER_ACCOUNTS = 2

  private

  def authed_accounts
    (session[:authed_accounts] || {}).transform_keys(&:to_s)
  end

  def authed_accounts=(hash)
    session[:authed_accounts] = hash.transform_keys(&:to_s)
  end

  # Record `user`'s active session in the set, preserving any accounts already
  # there (`prior`, captured before reset_session). Caps the set at
  # MAX_SWITCHER_ACCOUNTS by evicting the oldest OTHER account — the active
  # account is always kept, so the set never leaves the current account
  # untracked.
  def record_authed_account(user, session_id, prior: {})
    return if session_id.blank?

    key = user.id.to_s
    set = prior.transform_keys(&:to_s).merge(key => session_id)

    if set.size > MAX_SWITCHER_ACCOUNTS
      keep = [key] + (set.keys - [key]).last(MAX_SWITCHER_ACCOUNTS - 1)
      set  = set.slice(*keep)
    end

    self.authed_accounts = set
  end

  def prune_authed_account(user_id)
    set = authed_accounts
    set.delete(user_id.to_s)
    self.authed_accounts = set
  end

  # Point the signed _session_id cookie at an existing SessionActivation. Setting
  # this BEFORE sign_in makes the Warden after_set_user hook (config/initializers/
  # devise.rb) reuse that activation instead of minting a new one — so switching
  # creates no new session/token.
  def write_session_activation_cookie(session_id)
    cookies.signed['_session_id'] = {
      value: session_id,
      expires: 1.year.from_now,
      httponly: true,
      secure: Rails.env.production?,
      same_site: :lax,
    }
  end

  # Non-secret roster for the switcher UI. Returns id / acct / display name /
  # avatar / active-flag only — never a token or a session_id. Prunes (and
  # persists the pruning of) any entry whose activation has gone away.
  def switcher_roster
    set   = authed_accounts
    alive = {}

    roster = set.filter_map do |user_id, session_id|
      user = User.find_by(id: user_id)
      next if user.nil? || user.session_activations.find_by(session_id: session_id).nil?

      alive[user_id] = session_id
      account = user.account

      {
        id: user_id,
        acct: account.acct,
        display_name: account.display_name.presence || account.username,
        avatar: account.avatar_original_url,
        active: user_id == current_user&.id&.to_s,
      }
    end

    self.authed_accounts = alive if alive.size != set.size

    roster
  end

  def respond_switch(path)
    respond_to do |format|
      format.json { render json: { redirect_to: path }, status: 200 }
      format.all  { redirect_to path }
    end
  end
end
