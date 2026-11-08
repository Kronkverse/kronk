# frozen_string_literal: true

require 'rails_helper'

# decisions.md, 2026-11-08 (the Konnect grid): a Krew turns on its works as
# spaces (Gallery, Films, Music, Stories), each ending in New, whose
# composer also offers Add existing (Tal, 2026-11-08); a projekt's albums
# are a section with the same.
RSpec.describe 'Krew spaces: albums and works', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:krew) do
    Krew.create!(slug: 'painters', name: 'Painters', access: 'open', seeded_by: bob.account, last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: bob.account, role: 'seeder', source: 'direct')
    end
  end

  before { as_a_logged_in_user }

  it 'turns on a Gallery from Konnect, then adds an existing piece from New', :aggregate_failures do
    ArtPiece.create!(owner: bob.account, title: 'Blue study')

    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Konnect' }
    within('.attachment-picker') { click_on 'Art' }

    expect(page).to have_no_css('.attachment-picker')
    within('.attachment-section') { click_on 'Gallery' }
    within('.space-shelf') do
      expect(page).to have_css('h3', text: /gallery/i)
      expect(page).to have_no_button('Add existing')
      click_on 'New'
    end
    within('.compose-shell__existing') { click_on 'Add existing' }
    within('.attachment-picker') { click_on 'Blue study' }

    expect(page).to have_no_css('.compose-shell')
    visit "/hub/krew/#{krew.slug}"
    within('.space-shelf') { expect(page).to have_link('Blue study') }
    expect(krew.krew_korners.pluck(:korner)).to include('art')
  end

  it 'opens the piece composer from New, Konnected to the Krew' do
    krew.krew_korners.create!(korner: 'art')

    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Gallery' }
    within('.space-shelf') { click_on 'New' }

    expect(page).to have_css('.compose-shell')
    expect(page).to have_css('.konnect-row .space-tile', text: 'Painters')
  end

  it "offers Add existing in the Krew albums' New composer" do
    krew.krew_korners.create!(korner: 'albutts')

    visit "/hub/krew/#{krew.slug}"
    within('.attachment-section') { click_on 'Albutts' }
    within('.krew-detail__albums') { click_on 'New' }

    expect(page).to have_css('.compose-shell__existing', text: 'Add existing')
  end

  it "shows a projekt's albums once one is Konnected" do
    doof = Freethedream::Project.create!(title: 'Mini Doof', owner: bob.account)
    album = Album.create!(owner: bob.account, title: 'Set up day', visibility: :public)

    visit "/hub/freethedream/p/#{doof.slug}"
    expect(page).to have_css('.freethedream-detail')
    expect(page).to have_no_css('.space-shelf')

    KornerAttachment.create!(source_slug: 'albutts', source_id: album.id, target_slug: 'freethedream', target_id: doof.id,
                             kind: 'link', created_by_account: bob.account)
    visit "/hub/freethedream/p/#{doof.slug}"
    within('.space-shelf') do
      expect(page).to have_css('h3', text: /albums/i)
      expect(page).to have_link('Set up day')
      expect(page).to have_button('New')
    end
  end
end
