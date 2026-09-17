# frozen_string_literal: true

class HomeController < ApplicationController
  include WebAppControllerConcern
  include AccountSwitching

  # Signed-out `/` renders the landing view under the default
  # `application` layout — same layout every other Rails-served
  # signed-out surface uses (e.g. /kronk/*), which means the
  # `_kronk_static_chrome` top-band + wordmark render around it.
  # The starfield/void chassis is reserved for the signup ritual
  # (`/auth/sign_up`, `/auth/thresholds`), not for the landing.
  #
  # Signed-in `/` boots the SPA under the same layout, as before.

  # The landing view hosts an HTML form that POSTs to `/auth/sign_in`,
  # so the browser needs `form-action 'self'` in the CSP. The default
  # from WebAppControllerConcern is `form-action 'none'` because the
  # SPA never submits HTML forms (all POSTs are fetch/XHR), so this
  # override doesn't loosen anything the SPA relied on.
  content_security_policy do |p|
    p.form_action :self
  end

  def index
    # Landing embeds a per-request CSRF token, so we can't reuse the
    # public cache that the old signed-out `/` (a pure SPA boot) had.
    # Signed-in `/` didn't cache before either.
    if user_signed_in?
      render :index
    else
      # Any accounts previously authenticated on this browser (kept in
      # `session[:authed_accounts]`) are offered on the landing as
      # one-tap alternatives to typing credentials — see
      # `_switcher_roster.html.haml`. Returns [] when the session cookie
      # is fresh, so the landing renders unchanged for first-time
      # visitors.
      @switcher_roster = switcher_roster
      render :landing
    end
  end
end
