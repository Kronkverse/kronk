# frozen_string_literal: true

require 'rails_helper'

# The Ж menu's "New Kuddle" routes to /hub/huddle/composer, which opens the
# New Kuddle composer (the shared compose shell); creating goes straight into
# the new Kuddle (a Room, in the code). The old /hub/huddle/new forwards there.
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
    # A Kuddle's page starts the Jitsi call, and CI's browser has no camera
    # or microphone to give it.
    ignore_js_error(/gum\.not_found/)
  end

  it 'creates a Kuddle from the New Kuddle route and goes into it' do
    visit '/hub/huddle/composer'

    fill_in 'Kuddle name', with: 'Quiet study'
    click_on 'Create'

    expect(page).to have_current_path(%r{\A/hub/huddle/kuddle/\d+\z})
    expect(page).to have_text('Quiet study')
    expect(page).to have_button('Unhuddle')
    expect(page).to have_no_field('Kuddle name')
  end

  it 'closes the composer and tidies the address on cancel' do
    visit '/hub/huddle/composer'

    expect(page).to have_field('Kuddle name')
    click_on 'Cancel'

    expect(page).to have_no_field('Kuddle name')
    expect(page).to have_current_path('/hub/huddle')
  end

  it 'forwards the old New Kuddle address to the composer' do
    visit '/hub/huddle/new'

    expect(page).to have_current_path('/hub/huddle/composer')
    expect(page).to have_field('Kuddle name')
  end

  it 'forwards an old Room address to the Kuddle' do
    room = HuddleRoom::CreateService.new.call(account: bob.account, name: 'Old link')

    visit "/hub/huddle/room/#{room.id}"

    expect(page).to have_current_path("/hub/huddle/kuddle/#{room.id}")
  end

  context 'when arriving from a Krew' do
    let(:krew) do
      Krew.create!(slug: 'growers', name: 'Growers', access: 'open', last_activity_at: Time.current).tap do |k|
        k.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
      end
    end

    it 'Konnects the new Kuddle to that Krew' do
      visit "/hub/huddle/composer?krew=#{krew.id}"

      expect(page).to have_css('.konnect-row .space-tile', text: 'Growers')
      fill_in 'Kuddle name', with: 'Seed swap'
      click_on 'Create'

      expect(page).to have_current_path(%r{\A/hub/huddle/kuddle/\d+\z})
      room = HuddleSession.rooms.find_by!(title: 'Seed swap')
      expect(Kronk::AttachmentEffects.between('huddle', room.id, 'krew', krew.id)).to exist
    end
  end
end
