# frozen_string_literal: true

require 'rails_helper'

# decisions.md, 2026-10-23, "Location fields become Konnect → Map": a
# record's location is the Place it is Konnected to. Whatever reads a
# location falls back to that Place when the record's own old fields are
# empty; own fields still win (older records, the Android app).
RSpec.describe 'Location from a Konnected Place' do
  let(:author)   { Fabricate(:user) }
  let(:stranger) { Fabricate(:user) }
  let(:place) do
    MapPlace.create!(account: author.account, name: 'Fitzroy Gardens', address: 'Wellington Pde, East Melbourne',
                     latitude: -37.8136, longitude: 144.9799)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def link(slug, id, to: place, by: author)
    KornerAttachment.create!(source_slug: slug, source_id: id, target_slug: 'map', target_id: to.id,
                             kind: 'link', created_by_account: by.account)
  end

  def create_event(title, visibility: 'public', **params)
    post '/api/v1/events', headers: headers_for(author),
                           params: { title: title, start_time: 2.days.from_now.iso8601, visibility: visibility, **params }
    expect(response).to have_http_status(200)
    Event.find(response.parsed_body['id'])
  end

  describe 'events' do
    it "reads the Place's name and point when the event has no location" do
      event = create_event('Picnic')
      link('kalendar', event.id)

      get "/api/v1/events/#{event.id}", headers: headers_for(author)

      expect(response.parsed_body['location_name']).to eq('Fitzroy Gardens')
      url = response.parsed_body['location_url']
      expect(Kronk::OsmPin.parse(url)).to include(lat: be_within(0.0001).of(-37.8136), lng: be_within(0.0001).of(144.9799))
    end

    it 'reads it the other way round too, a Place linked to the event by its host' do
      event = create_event('Picnic')
      KornerAttachment.create!(source_slug: 'map', source_id: place.id, target_slug: 'kalendar', target_id: event.id,
                               kind: 'link', created_by_account: author.account)

      get "/api/v1/events/#{event.id}", headers: headers_for(author)

      expect(response.parsed_body['location_name']).to eq('Fitzroy Gardens')
    end

    it "keeps the event's own location" do
      event = create_event('Picnic', location_name: 'The rotunda', location_url: 'https://www.openstreetmap.org/?mlat=-33.87&mlon=151.21')
      link('kalendar', event.id)

      get "/api/v1/events/#{event.id}", headers: headers_for(author)

      expect(response.parsed_body).to include('location_name' => 'The rotunda',
                                              'location_url' => 'https://www.openstreetmap.org/?mlat=-33.87&mlon=151.21')
    end

    it "doesn't let someone else's Place say where the event is" do
      event = create_event('Picnic')
      theirs = MapPlace.create!(account: stranger.account, name: 'Somewhere else', latitude: 1, longitude: 1)
      KornerAttachment.create!(source_slug: 'map', source_id: theirs.id, target_slug: 'kalendar', target_id: event.id,
                               kind: 'link', created_by_account: stranger.account)

      get "/api/v1/events/#{event.id}", headers: headers_for(author)

      expect(response.parsed_body['location_name']).to be_nil
    end

    it 'reads the Places of a whole list' do
      linked = create_event('Picnic')
      link('kalendar', linked.id)
      create_event('Nowhere')

      get '/api/v1/events', headers: headers_for(author)

      names = response.parsed_body.to_h { |event| [event['title'], event['location_name']] }
      expect(names).to include('Picnic' => 'Fitzroy Gardens', 'Nowhere' => nil)
    end
  end

  describe 'map event pins' do
    def pins_for(user)
      get '/api/v1/map/events', headers: headers_for(user)
      expect(response).to have_http_status(200)
      response.parsed_body.index_by { |pin| pin['title'] }
    end

    it 'pins an event with no location at its Place' do
      link('kalendar', create_event('Picnic').id)

      pin = pins_for(stranger)['Picnic']

      expect(pin).to include('location_name' => 'Fitzroy Gardens')
      expect(pin['lat']).to be_within(0.0001).of(-37.8136)
      expect(pin['lng']).to be_within(0.0001).of(144.9799)
    end

    it "keeps to the event's reach" do
      link('kalendar', create_event('Just me', visibility: 'self_only').id)

      expect(pins_for(stranger)).to_not have_key('Just me')
      expect(pins_for(author)).to have_key('Just me')
    end

    it 'leaves out an event with neither a location nor a Place' do
      create_event('Nowhere')

      expect(pins_for(author)).to_not have_key('Nowhere')
    end
  end

  describe 'kars' do
    it "reads the Place when the kar has no location, and keeps a kar's own" do
      bare = Kar.create!(owner: author.account, title: 'Ute', make: 'Holden', model: 'Kingswood', year: 1976)
      own = Kar.create!(owner: author.account, title: 'Falcon', make: 'Ford', model: 'Falcon', year: 1972,
                        location_lat: -33.87, location_lng: 151.21, location_label: 'Sydney')
      link('karporn', bare.id)
      link('karporn', own.id)

      get "/api/v1/karporn/kars/#{bare.id}", headers: headers_for(author)
      expect(response.parsed_body['location']).to include('label' => 'Fitzroy Gardens', 'lat' => be_within(0.0001).of(-37.8136))

      get '/api/v1/karporn/kars', headers: headers_for(author), params: { scope: 'mine' }
      labels = response.parsed_body.to_h { |kar| [kar['title'], kar.dig('location', 'label')] }
      expect(labels).to eq('Ute' => 'Fitzroy Gardens', 'Falcon' => 'Sydney')
    end
  end

  describe 'wachuneed listings' do
    it "reads the Place's name when the listing has no location, and keeps a listing's own" do
      bare = Listing.create!(account: author.account, title: 'Red bike', category: 'goods', state: 'live')
      own = Listing.create!(account: author.account, title: 'Blue bike', category: 'goods', state: 'live', location: 'Carlton')
      link('wachuneed', bare.id)
      link('wachuneed', own.id)

      get "/api/v1/wachuneed/listings/#{bare.id}", headers: headers_for(author)
      expect(response.parsed_body['location']).to eq('Fitzroy Gardens')

      get '/api/v1/wachuneed/listings', headers: headers_for(author), params: { mine: true }
      locations = response.parsed_body.to_h { |listing| [listing['title'], listing['location']] }
      expect(locations).to eq('Red bike' => 'Fitzroy Gardens', 'Blue bike' => 'Carlton')
    end
  end
end
