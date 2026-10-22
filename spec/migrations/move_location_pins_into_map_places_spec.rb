# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db', 'migrate', '20261023140100_move_location_pins_into_map_places.rb')

# Pinned events and kars everyone can see get a Map Place and a link to it
# (decisions.md, 2026-10-23, "Map Places: location is a Konnection").
RSpec.describe MoveLocationPinsIntoMapPlaces do
  def run!
    migration = described_class.new
    migration.suppress_messages { migration.up }
  end

  let(:account) { Fabricate(:account) }
  let(:pin_url) { 'https://www.openstreetmap.org/?mlat=-37.8131&mlon=144.9799#map=16/-37.8131/144.9799' }

  def event_with(location_name:, location_url: pin_url, visibility: :public)
    status = Fabricate(:status, account: account, visibility: visibility)
    Event.create!(account: account, title: 'Picnic', status: status, start_time: 2.days.from_now,
                  location_name: location_name, location_url: location_url)
  end

  def place_of(slug, id)
    link = KornerAttachment.find_by(source_slug: slug, source_id: id, target_slug: 'map')
    link && MapPlace.find(link.target_id)
  end

  it "gives a public pinned event a Place, linked by the event's owner" do
    event = event_with(location_name: 'Fitzroy Gardens')

    run!

    place = place_of('kalendar', event.id)
    expect(place).to have_attributes(name: 'Fitzroy Gardens', address: 'Fitzroy Gardens', account_id: account.id)
    expect(place.latitude.to_f).to be_within(0.000001).of(-37.8131)
    expect(KornerAttachment.find_by(source_slug: 'kalendar', source_id: event.id).created_by_account_id).to eq(account.id)
  end

  it 'names an unnamed pin, and makes one Place for one venue' do
    unnamed = event_with(location_name: nil)
    first = event_with(location_name: 'Town hall')
    second = event_with(location_name: 'Town hall')

    run!

    expect(place_of('kalendar', unnamed.id).name).to eq('Pinned place')
    expect(place_of('kalendar', first.id)).to eq(place_of('kalendar', second.id))
  end

  it "leaves a Mates-only event, and a link that isn't a pin, alone" do
    private_event = event_with(location_name: 'My house', visibility: :mates)
    zoom_link = event_with(location_name: 'Online', location_url: 'https://example.com/call')

    run!

    expect(place_of('kalendar', private_event.id)).to be_nil
    expect(place_of('kalendar', zoom_link.id)).to be_nil
  end

  it 'gives a public kar with a location a Place' do
    kar = Kar.create!(owner: account, title: 'Ute', make: 'Holden', model: 'Kingswood', year: 1976,
                      location_label: 'Bathurst', location_lat: -33.42, location_lng: 149.58)
    Kar.create!(owner: account, title: 'Hidden', make: 'Ford', model: 'Falcon', year: 1972, visibility: :mates,
                location_label: 'Garage', location_lat: -33.0, location_lng: 149.0)

    run!

    expect(place_of('karporn', kar.id)).to have_attributes(name: 'Bathurst')
    expect(MapPlace.count).to eq 1
  end

  it 'is safe to run twice' do
    event_with(location_name: 'Fitzroy Gardens')

    expect { run! }.to change(MapPlace, :count).by(1)
    expect { run! }.to_not change(KornerAttachment, :count)
  end
end
