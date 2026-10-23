# frozen_string_literal: true

require 'rails_helper'

# decisions.md, 2026-10-23: any creation Konnects to any other. A composer
# holds its Konnections until what it makes exists (hooks/useKonnect.ts),
# shown in the Konnect row <ComposeShell> draws, and Konnects them once the
# create succeeds.
RSpec.describe 'Konnecting from a composer', :js, :streaming do
  include ProfileStories

  let(:email)               { 'test@example.com' }
  let(:password)            { 'password' }
  let(:confirmed_at)        { Time.zone.now }
  let(:finished_onboarding) { true }

  let(:album) { Album.create!(owner: bob.account, title: 'Studio days', visibility: :public) }

  before { as_a_logged_in_user }

  it 'Konnects a new art piece to an album picked in the Konnect row' do
    album
    visit '/hub/art/composer'

    within('.compose-shell') do
      find('.art-composer__title').set('Blue study')
      within('.konnect-row') { click_on 'Konnect' }
    end
    within('.attachment-picker') do
      click_on 'Albutts'
      click_on 'Studio days'
    end

    within('.compose-shell') do
      expect(page).to have_css('.konnect-row .space-tile', text: 'Studio days')
      click_on 'Post piece'
    end

    expect(page).to have_no_css('.compose-shell')
    piece = ArtPiece.find_by!(title: 'Blue study')
    expect(KornerAttachment.where(source_slug: 'art', source_id: piece.id, target_slug: 'albutts', target_id: album.id, kind: 'link')).to exist
  end

  # decisions.md, 2026-10-23, "Location fields become Konnect → Map": no
  # location field; the picker makes a Place without leaving the composer.
  it "makes a new Place from an event's Konnect row, which says where the event is" do
    allow(Kronk::Geocoder).to receive(:search).and_return([{ lat: -37.8136, lng: 144.9799 }])
    visit '/hub/kalendar/composer'

    within('.compose-shell') do
      expect(page).to have_no_field('Address')
      find('input[placeholder="What is happening?"]').set('Picnic')
      within('.konnect-row') { click_on 'Konnect' }
    end
    new_place_in_picker('Fitzroy Gardens', 'Wellington Pde, East Melbourne')
    within('.compose-shell') do
      expect(page).to have_css('.konnect-row .space-tile', text: 'Fitzroy Gardens')
      click_on 'Post it'
    end

    expect(page).to have_css('.event-detail__location', text: 'Fitzroy Gardens')
    expect(page).to have_css('.space-tile', text: 'Fitzroy Gardens')
    place = MapPlace.find_by!(name: 'Fitzroy Gardens', address: 'Wellington Pde, East Melbourne', account: bob.account)
    event = Event.find_by!(title: 'Picnic', location_name: nil)
    expect(KornerAttachment.where(source_slug: 'kalendar', source_id: event.id, target_slug: 'map', target_id: place.id)).to exist
  end

  def new_place_in_picker(name, address)
    within('.attachment-picker') do
      click_on 'Map'
      click_on 'New place'
      fill_in 'Name', with: name
      fill_in 'Address (optional)', with: address
      click_on 'Add place'
    end
    expect(page).to have_no_css('.attachment-picker')
  end

  it 'opens on the record it was made from, which can be dropped' do
    visit "/hub/art/composer?konnect=albutts:#{album.id}"

    within('.konnect-row') do
      expect(page).to have_css('.space-tile', text: 'Studio days')
      click_on 'Diskonnect Studio days'
      expect(page).to have_no_css('.space-tile', text: 'Studio days')
    end
  end
end
