# frozen_string_literal: true

# Server-side courtesy for the sign-up form: is this username available?
# The signup form still validates on submit — this endpoint is advisory
# so the "@thing is yours" hint can settle while the member is typing.
#
# Response shape: `{ available: <bool>, reason: <string|nil> }`. `reason`
# is `"invalid"` / `"taken"` / `"reserved"` / nil.
#
# Reuses the same regex + reserved-username source the User/Account
# model uses (Account local-username regex + UnreservedUsernameValidator
# via `UsernameBlock`) — no duplicate logic.
#
# Throttled to 20/min per IP in `config/initializers/rack_attack.rb`.
class Auth::UsernameAvailabilityController < ApplicationController
  skip_before_action :require_functional!

  # No `skip_before_action :verify_authenticity_token` here: the route is a
  # GET (`get 'username_available'`), and Rails never verifies a token on
  # GET or HEAD — `verified_request?` short-circuits on them. The skip was
  # therefore a no-op that read as "CSRF is off on this controller", which
  # is both untrue and the kind of line that gets copied to a POST later.

  LOCAL_USERNAME_RE = /\A[a-z0-9_]+\z/i
  MIN_LEN = 3
  MAX_LEN = Account::USERNAME_LENGTH_LIMIT

  def show
    username = params[:username].to_s.strip

    render json: check(username)
  end

  private

  def check(username)
    if username.blank? || username.length < MIN_LEN || username.length > MAX_LEN || !username.match?(LOCAL_USERNAME_RE)
      { available: false, reason: 'invalid' }
    elsif UsernameBlock.matches?(username, allow_with_approval: false)
      { available: false, reason: 'reserved' }
    elsif Account.exists?(username: username, domain: nil)
      { available: false, reason: 'taken' }
    else
      { available: true, reason: nil }
    end
  end
end
