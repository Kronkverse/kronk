# frozen_string_literal: true

require 'rails_helper'

# Kronk's settings are part of the web app (there is no Rails preferences
# sidebar to log out from), and "Log out" lives on your own profile's
# owner toolbar, behind a confirmation dialog.
RSpec.describe 'Log out', :js, :streaming do
  include ProfileStories

  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
  end

  it 'logs the user out from their profile' do
    # The frontend tries to load announcements after a short delay, but the session might be expired by then, and the browser will output an error.
    ignore_js_error(/Failed to load resource: the server responded with a status/)

    visit short_account_path(bob.account)

    within '.profile-shelves__edit-toolbar' do
      click_on frontend_translations('profile_shelves.log_out')
    end

    within '.modal-root' do
      click_on frontend_translations('confirmations.logout.confirm')
    end

    # Signed out, Kronk shows its sign-in landing.
    expect(page)
      .to have_title(I18n.t('auth.login'))
      .and have_field('user_email')
  end
end
