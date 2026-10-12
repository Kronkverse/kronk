# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md: who made a set. The artist is the uploader; others
# are credited by them, tagged accounts unverified until they confirm.
RSpec.describe 'Booth', :inline_jobs, :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }
  let(:ash)                 { Fabricate(:account, username: 'ash', display_name: 'Ash') }
  let(:set) do
    Fabricate(:booth_set, account: ash, title: 'Dawn at the point', artist_name: 'Ash & Maddog', published: true,
                          audio_attachment: Fabricate(:media_attachment, account: ash))
  end

  before do
    as_a_logged_in_user
    set.credits.create!(account: bob.account, position: 0)
    set.credits.create!(name: 'Lena K', position: 1)
    set.update!(artist_name: set.credit_line)
  end

  it 'lists artists as people, not as the lines typed on sets' do
    visit '/hub/booth/artists'

    expect(page).to have_css('.booth-artist-chip', count: 3)
    expect(page).to have_css('.booth-artist-chip', text: 'Ash')
    expect(page).to have_css('.booth-artist-chip', text: 'Lena K')

    find('.booth-artist-chip', text: 'Ash').click
    expect(page).to have_current_path('/hub/booth/artists/%40ash')
    expect(page).to have_content('Dawn at the point')
  end

  it 'shows a tagged person as unverified until they say it is them' do
    visit "/hub/booth/sets/#{set.id}"

    expect(page).to have_css('.booth-credit', text: '@ash')
    expect(page).to have_css('.booth-credit', text: /@#{bob.account.username}\s*unverified/)
    expect(page).to have_css('.booth-credit', text: 'Lena K')

    click_on "That\u2019s me"
    expect(page).to have_no_content('unverified')
    expect(set.credits.find_by(account: bob.account)).to be_verified

    click_on 'Take me off'
    expect(page).to have_no_css('.booth-credit', text: "@#{bob.account.username}")
    expect(set.reload.artist_name).to eq 'Ash & Lena K'
  end

  it 'credits people from the edit form: a tagged account and a plain name' do
    mine = Fabricate(:booth_set, account: bob.account, title: 'Low tide', published: true,
                                 audio_attachment: Fabricate(:media_attachment, account: bob.account))
    ash

    visit "/hub/booth/sets/#{mine.id}"
    find('.kronk-menu__trigger').click
    click_on 'Edit set'

    fill_in placeholder: 'Search Kronk, or type a name', with: 'ash'
    within('.booth-credits__found') { click_on 'Ash' }
    fill_in placeholder: 'Search Kronk, or type a name', with: 'Lena K'
    click_on "Add \u201CLena K\u201D as a name (not on Kronk)"
    click_on 'Save changes'

    expect(page).to have_css('.booth-credit', text: /@ash\s*unverified/)
    expect(page).to have_css('.booth-credit', text: 'Lena K')
    expect(mine.reload.credits.map(&:label)).to eq ['Ash', 'Lena K']
  end
end
