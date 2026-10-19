# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/albutts.md, Who can add photos: nobody else adds unless the
# owner says so, and an album can be registered as a Krew's from here.
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

  it 'registers the album as a Krew album, and goes back' do
    visit '/hub/albutts/composer'
    find('.krew-multi-select__chip', text: 'Growers').click

    expect(page).to have_css('.albutts-composer__contribution-chip--selected', text: 'Only Growers')
    click_on 'Keep it mine'
    expect(page).to have_css('.albutts-composer__contribution-chip--selected', text: 'Just me')
  end
end
