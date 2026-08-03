# frozen_string_literal: true

class HomeController < ApplicationController
  include WebAppControllerConcern

  # Signed-out `/` renders the landing view (void starfield + inline
  # sign-in form) instead of booting the SPA and falling through to
  # `/explore`. Signed-in `/` boots the SPA as before. Layout swap only
  # happens for the landing branch — the SPA render path continues to
  # use the default `application` layout.
  layout :determine_layout

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
      render :landing
    end
  end

  private

  def determine_layout
    user_signed_in? ? 'application' : 'kronk_void'
  end
end
