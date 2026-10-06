# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'NewStatuses', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:status_text) { 'This is a new status!' }

  before { as_a_logged_in_user }

  it 'can be posted' do
    visit_homepage

    within('.compose-form') do
      fill_in frontend_translations('compose_form.placeholder'), with: status_text
      click_on frontend_translations('compose_form.publish')
    end

    # Kronk returns to `/` after posting (and from there to the greeting on
    # a session's first visit), and profiles show shelves rather than a
    # post list — so check the post landed, then open it directly.
    expect(page).to have_no_current_path('/publish')
    status = Status.find_by(text: status_text)
    expect(status).to be_present

    visit short_account_status_path(bob.account, status)

    expect(page)
      .to have_content(status_text)
  end

  # Kronk's home feed has no inline composer; "Post" in the Kronk menu
  # opens the composer at /publish.
  def visit_homepage
    visit '/publish'

    expect(page)
      .to have_css('div.app-holder')
      .and have_css('form.compose-form')
  end
end
