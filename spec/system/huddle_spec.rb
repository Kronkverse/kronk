# frozen_string_literal: true

require 'rails_helper'

# The Ж menu's "New Room" routes to /hub/huddle/composer, which opens the
# New Room composer (the shared compose shell); creating goes straight into
# the new Room. The old /hub/huddle/new forwards there.
# docs/spaces/huddle.md § Rooms.
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

  it 'creates a Room from the New Room route and goes into it' do
    visit '/hub/huddle/composer'

    fill_in 'Room name', with: 'Quiet study'
    click_on 'Create'

    expect(page).to have_current_path(%r{\A/hub/huddle/room/\d+\z})
    expect(page).to have_text('Quiet study')
    expect(page).to have_button('Unhuddle')
    expect(page).to have_no_field('Room name')
  end

  it 'closes the composer and tidies the address on cancel' do
    visit '/hub/huddle/composer'

    expect(page).to have_field('Room name')
    click_on 'Cancel'

    expect(page).to have_no_field('Room name')
    expect(page).to have_current_path('/hub/huddle')
  end

  it 'forwards the old New Room address to the composer' do
    visit '/hub/huddle/new'

    expect(page).to have_current_path('/hub/huddle/composer')
    expect(page).to have_field('Room name')
  end

  context 'when arriving from a Krew' do
    let(:krew) do
      Krew.create!(slug: 'growers', name: 'Growers', access: 'open', last_activity_at: Time.current).tap do |k|
        k.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
      end
    end

    it 'Konnects the new Room to that Krew' do
      visit "/hub/huddle/composer?krew=#{krew.id}"

      expect(page).to have_css('.krew-multi-select__chip--selected', text: 'Growers')
      fill_in 'Room name', with: 'Seed swap'
      click_on 'Create'

      expect(page).to have_current_path(%r{\A/hub/huddle/room/\d+\z})
      room = HuddleSession.rooms.find_by!(title: 'Seed swap')
      expect(Kronk::AttachmentEffects.between('huddle', room.id, 'krew', krew.id)).to exist
    end
  end
end
