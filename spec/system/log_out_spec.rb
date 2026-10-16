# frozen_string_literal: true

require 'rails_helper'

# Kronk's settings are part of the web app (there is no Rails preferences
# sidebar to log out from). Signing out is a spoke of the /me hub; the
# profile's own Log out button was removed (Tal, 2026-10-15).
RSpec.describe 'Log out', :js, :streaming do
  include ProfileStories

  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
  end

  it 'logs the user out from the /me hub' do
    # The frontend tries to load announcements after a short delay, but the session might be expired by then, and the browser will output an error.
    ignore_js_error(/Failed to load resource: the server responded with a status/)

    visit '/me'

    click_on frontend_translations('me_hub.sign_out')

    # Signed out, Kronk shows its sign-in landing.
    expect(page)
      .to have_title(I18n.t('auth.login'))
      .and have_field('user_email')
  end
end
