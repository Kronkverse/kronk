# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db', 'migrate', '20261023140100_move_location_pins_into_map_places.rb')

# Every pinned event and kar gets a Map Place and a link to it, so the
# Place is seen by whoever sees the record (decisions.md, 2026-10-23, "Map
# Places: location is a Konnection").
RSpec.describe MoveLocationPinsIntoMapPlaces do
  def run!
    migration = described_class.new
    migration.suppress_messages { migration.up }
  end

  let(:account) { Fabricate(:account) }
  let(:pin_url) { 'https://www.openstreetmap.org/?mlat=-37.8131&mlon=144.9799#map=16/-37.8131/144.9799' }

  def event_with(location_name:, location_url: pin_url, visibility: :public, owner: account)
    status = Fabricate(:status, account: owner, visibility: visibility)
    Event.create!(account: owner, title: 'Picnic', status: status, start_time: 2.days.from_now,
                  location_name: location_name, location_url: location_url)
  end

  def place_of(slug, id)
    link = KornerAttachment.find_by(source_slug: slug, source_id: id, target_slug: 'map')
    link && MapPlace.find(link.target_id)
  end

  it "gives a pinned event a Place, made and linked by the event's owner" do
    event = event_with(location_name: 'Fitzroy Gardens')

    run!

    place = place_of('kalendar', event.id)
    expect(place).to have_attributes(name: 'Fitzroy Gardens', address: 'Fitzroy Gardens', account_id: account.id)
    expect(place.latitude.to_f).to be_within(0.000001).of(-37.8131)
    expect(KornerAttachment.find_by(source_slug: 'kalendar', source_id: event.id).created_by_account_id).to eq(account.id)
  end

  it 'moves a Mates-only event too, its Place seen only by who sees the event' do
    party = event_with(location_name: 'My house', visibility: :mates)
    stranger = Fabricate(:account)

    run!

    place = place_of('kalendar', party.id)
    expect(place.visible_to?(account)).to be(true)
    expect(place.visible_to?(stranger)).to be(false)
  end

  it "names an unnamed pin, shares a venue within one owner's records, and never across owners" do
    unnamed = event_with(location_name: nil)
    first = event_with(location_name: 'Town hall')
    second = event_with(location_name: 'Town hall')
    someone_elses = event_with(location_name: 'Town hall', owner: Fabricate(:account))

    run!

    expect(place_of('kalendar', unnamed.id).name).to eq('Pinned place')
    expect(place_of('kalendar', first.id)).to eq(place_of('kalendar', second.id))
    expect(place_of('kalendar', someone_elses.id)).to_not eq(place_of('kalendar', first.id))
  end

  it "leaves a location link that isn't a pin alone" do
    zoom_link = event_with(location_name: 'Online', location_url: 'https://example.com/call')

    run!

    expect(place_of('kalendar', zoom_link.id)).to be_nil
  end

  it 'gives every kar with a location a Place' do
    kar = Kar.create!(owner: account, title: 'Ute', make: 'Holden', model: 'Kingswood', year: 1976,
                      location_label: 'Bathurst', location_lat: -33.42, location_lng: 149.58)
    hidden = Kar.create!(owner: account, title: 'Hidden', make: 'Ford', model: 'Falcon', year: 1972, visibility: :mates,
                         location_label: 'Garage', location_lat: -33.0, location_lng: 149.0)

    run!

    expect(place_of('karporn', kar.id)).to have_attributes(name: 'Bathurst')
    expect(place_of('karporn', hidden.id)).to have_attributes(name: 'Garage')
  end

  it 'is safe to run twice' do
    event_with(location_name: 'Fitzroy Gardens')

    expect { run! }.to change(MapPlace, :count).by(1)
    expect { run! }.to_not change(KornerAttachment, :count)
  end
end
