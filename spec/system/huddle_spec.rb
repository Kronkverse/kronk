# frozen_string_literal: true

require 'rails_helper'

# The Ж menu's "New Room" routes to /hub/huddle/new, which opens the create
# form in the Rooms list. docs/spaces/huddle.md § Rooms.
RSpec.describe 'Huddle', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    # The lobby asks the Jitsi host how many people are in the Main Huddle,
    # a server this suite does not run.
    ignore_js_error(/Failed to load resource: the server responded with a status of 404/)
  end

  it 'creates a Room from the New Room route' do
    visit '/hub/huddle/new'

    fill_in 'Room name', with: 'Quiet study'
    click_on 'Create'

    expect(page).to have_css('.huddle-rooms__card-name', text: 'Quiet study')
    expect(page).to have_current_path('/hub/huddle')
    expect(page).to have_no_field('Room name')
  end

  it 'closes the form and tidies the address on cancel' do
    visit '/hub/huddle/new'

    expect(page).to have_field('Room name')
    click_on 'Cancel'

    expect(page).to have_no_field('Room name')
    expect(page).to have_current_path('/hub/huddle')
  end
end
