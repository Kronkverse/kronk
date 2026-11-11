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

  # Kommons "Composers are too busy": the choices are the kit's KornerPills,
  # one lit, not bespoke chips.
  it 'starts at Just me' do
    visit '/hub/albutts/composer'

    expect(page).to have_css('.albutts-composer__choices .korner-pill--active', text: 'Just me')
    expect(page).to have_css('.albutts-composer__choices .korner-pill', count: 3)
    expect(page).to have_no_css('.albutts-composer__contribution-chip')
  end

  it 'makes it a Krew album when one of your Krews is Konnected, and goes back' do
    visit '/hub/albutts/composer'
    within('.compose-shell .konnect-row') { click_on 'Konnect' }
    within('.attachment-picker') do
      click_on 'Krews'
      click_on 'Growers'
    end

    expect(page).to have_css('.albutts-composer__choices .korner-pill--active', text: 'Only Growers')
    click_on 'Keep it mine'
    expect(page).to have_css('.albutts-composer__choices .korner-pill--active', text: 'Just me')
    expect(page).to have_no_css('.konnect-row .space-tile', text: 'Growers')
  end

  # docs/spaces/albutts.md, Who can see an album: people chosen by name, in
  # the reach menu's People row.
  it 'shares a Just-me album with the people you choose' do
    ana = Fabricate(:account, username: 'ana', display_name: 'Ana')
    visit '/hub/albutts/composer'
    find('.compose-title').set('Secret garden')

    find('.reach-dropdown__button').click
    within('.reach-dropdown__menu') do
      find('.reach-dropdown__item', text: /\AMe/).click
      find('.reach-dropdown__krews-row', text: 'People').hover
      fill_in placeholder: 'Search people…', with: 'ana'
      find('.account-multi-select__suggestion', text: 'ana').click
    end
    expect(page).to have_text('Only you and the person you chose can see it.')

    click_on 'Create album'
    expect(page).to have_no_css('.compose-shell')
    expect(Album.find_by(title: 'Secret garden').album_viewers.pluck(:account_id)).to eq [ana.id]
  end

  # Tal, 2026-11-11: a little x in the photo's corner takes it out.
  it 'takes one photo out with the x in its corner' do
    visit '/hub/albutts/composer'
    find('.compose-title').set('Two photos')
    attach_file('albutts-composer-photos', [file_fixture('600x400.png'), file_fixture('attachment.jpg')], make_visible: true)
    expect(page).to have_css('.albutts-composer__pick', count: 2)

    first('.albutts-composer__pick').find('.albutts-composer__pick-remove').click

    expect(page).to have_css('.albutts-composer__pick', count: 1)
    expect(page).to have_button('Create album & add 1 photo')
  end
end
