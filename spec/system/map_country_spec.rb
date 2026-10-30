# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/map.md: First Nations Country. A profile's "Born on" and
# "Living on <name> Country" open that Country on the Map.
RSpec.describe 'Map Country', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:ana) { Fabricate(:user, account: Fabricate(:account, username: 'ana', first_nations_country: 'Mardu', first_nations_country_born: 'Kaurna')).account }

  before do
    as_a_logged_in_user
    bob.account.follow!(ana)
    ana.follow!(bob.account)
  end

  it 'shows First Nations Country on the map without a switch' do
    visit '/hub/map'

    expect(page).to have_field('Find a Country')
    expect(page).to have_no_button('First Nations Country')
  end

  it 'opens the Country from a profile' do
    visit '/@ana'
    expect(page).to have_link('Born on Kaurna Country')
    click_on 'Living on Mardu Country'

    expect(page).to have_current_path(%r{/hub/map\?country=Mardu\z})
    expect(page).to have_css('.map-country__card', text: 'Mardu Country')
  end

  it 'adds another name to a Country from its card' do
    visit '/@ana'
    click_on 'Living on Mardu Country'

    within('.map-country__card') do
      fill_in 'Add another name', with: 'Martu'
      click_on 'Add'
      expect(page).to have_css('.map-country__added-name', text: 'Martu')
    end

    expect(MapCountryName.find_by(name: 'Martu')).to have_attributes(account: bob.account, shape_id: Integer)
  end
end
