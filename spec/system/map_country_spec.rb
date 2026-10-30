# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/map.md: First Nations Country. A profile's "On <name> Country"
# opens that Country on the Map.
RSpec.describe 'Map Country', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:ana) { Fabricate(:user, account: Fabricate(:account, username: 'ana', first_nations_country: 'Mardu')).account }

  before do
    as_a_logged_in_user
    bob.account.follow!(ana)
    ana.follow!(bob.account)
  end

  it 'opens the Country from a profile' do
    visit '/@ana'
    click_on 'On Mardu Country'

    expect(page).to have_current_path(%r{/hub/map\?country=Mardu\z})
    expect(page).to have_css('.map-country__card', text: 'Mardu Country')
  end
end
