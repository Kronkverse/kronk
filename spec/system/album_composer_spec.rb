# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/albutts.md, Who can add photos: nobody else adds unless the
# owner says so, and an album Konnected to one of your Krews here is that
# Krew's album.
RSpec.describe 'Album composer, who can add', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  before do
    as_a_logged_in_user
    Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: bob.account, last_activity_at: Time.current)
        .krew_memberships.create!(account: bob.account, role: 'member', source: 'direct')
  end

  it 'starts at Just me' do
    visit '/hub/albutts/composer'

    expect(page).to have_css('.albutts-composer__contribution-chip--selected', text: 'Just me')
  end

  it 'makes it a Krew album when one of your Krews is Konnected, and goes back' do
    visit '/hub/albutts/composer'
    within('.compose-shell .konnect-row') { click_on 'Konnect' }
    within('.attachment-picker') do
      click_on 'Krews'
      click_on 'Growers'
    end

    expect(page).to have_css('.albutts-composer__contribution-chip--selected', text: 'Only Growers')
    click_on 'Keep it mine'
    expect(page).to have_css('.albutts-composer__contribution-chip--selected', text: 'Just me')
    expect(page).to have_no_css('.konnect-row .space-tile', text: 'Growers')
  end
end
