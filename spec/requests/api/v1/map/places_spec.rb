# frozen_string_literal: true

require 'rails_helper'

# Map Places: exact spots with an address that a location Konnects to
# (docs/spaces/map.md, Places). A Place is seen by whoever can see
# something Konnected to it, and its maker, who looks after it.
RSpec.describe 'Map places' do
  let(:maker) { Fabricate(:user) }
  let(:other) { Fabricate(:user) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def event_by(user, visibility: :public)
    status = Fabricate(:status, account: user.account, visibility: visibility)
    Event.create!(account: user.account, title: 'Picnic', status: status, start_time: 2.days.from_now)
  end

  def konnect(record, place, slug: 'kalendar')
    KornerAttachment.create!(source_slug: slug, source_id: record.id, target_slug: 'map', target_id: place.id,
                             kind: 'link', created_by_account: record.account)
  end

  def make_place(name: 'Fitzroy Gardens', address: 'Wellington Pde, East Melbourne', lat: -37.8131, lng: 144.9799, account: maker.account)
    MapPlace.create!(name: name, address: address, latitude: lat, longitude: lng, account: account)
  end

  describe 'POST /api/v1/map/places' do
    it 'makes a Place at an exact point' do
      post '/api/v1/map/places', headers: headers_for(maker),
                                 params: { name: 'Fitzroy Gardens', address: 'Wellington Pde, East Melbourne', latitude: -37.8131, longitude: 144.9799 }

      expect(response).to have_http_status(200)
      body = response.parsed_body
      expect(body).to include('name' => 'Fitzroy Gardens', 'address' => 'Wellington Pde, East Melbourne', 'is_owner' => true)
      expect(body['latitude']).to be_within(0.000001).of(-37.8131)
      expect(body['url']).to eq("/hub/map/places/#{body['id']}")
    end

    it 'finds the point from the address when none is sent' do
      allow(Kronk::Geocoder).to receive(:search).with('Flinders St Station').and_return([{ label: 'Flinders Street Station', lat: -37.8183, lng: 144.9671 }])

      post '/api/v1/map/places', headers: headers_for(maker), params: { name: 'The station', address: 'Flinders St Station' }

      expect(response).to have_http_status(200)
      expect(response.parsed_body['longitude']).to be_within(0.000001).of(144.9671)
    end

    it "refuses an address the geocoder can't find, and a point off the globe" do
      allow(Kronk::Geocoder).to receive(:search).and_return([])
      post '/api/v1/map/places', headers: headers_for(maker), params: { name: 'Nowhere', address: 'asdfgh' }
      expect(response).to have_http_status(422)

      post '/api/v1/map/places', headers: headers_for(maker), params: { name: 'Off the map', latitude: 91, longitude: 0 }
      expect(response).to have_http_status(422)
    end

    it 'needs a name' do
      post '/api/v1/map/places', headers: headers_for(maker), params: { latitude: 1, longitude: 1 }
      expect(response).to have_http_status(422)
    end
  end

  describe 'who sees a Place' do
    let(:stranger) { Fabricate(:user) }
    let!(:place) { make_place }

    def visible_ids(user, **params)
      get '/api/v1/map/places', headers: headers_for(user), params: params
      response.parsed_body.pluck('id')
    end

    it 'shows a Place with no Konnections to its maker only' do
      get "/api/v1/map/places/#{place.id}", headers: headers_for(maker)
      expect(response).to have_http_status(200)

      get "/api/v1/map/places/#{place.id}", headers: headers_for(stranger)
      expect(response).to have_http_status(404)
      expect(visible_ids(stranger, bbox: '144,-38,146,-37')).to be_empty
      expect(visible_ids(maker, bbox: '144,-38,146,-37')).to eq([place.id.to_s])
    end

    it 'shows it to whoever can see a public event Konnected to it' do
      konnect(event_by(maker), place)

      get "/api/v1/map/places/#{place.id}", headers: headers_for(stranger)
      expect(response).to have_http_status(200)
      expect(response.parsed_body['is_owner']).to be(false)
      expect(visible_ids(stranger, bbox: '144,-38,146,-37')).to eq([place.id.to_s])
    end

    it "hides it from someone who can't see the private event Konnected to it" do
      konnect(event_by(maker, visibility: :self_only), place)

      get "/api/v1/map/places/#{place.id}", headers: headers_for(stranger)
      expect(response).to have_http_status(404)
      expect(visible_ids(stranger)).to be_empty

      get '/api/v1/attachments/candidates?korner=map&q=fitzroy', headers: headers_for(stranger)
      expect(response.parsed_body).to be_empty
    end
  end

  describe 'GET /api/v1/map/places' do
    before do
      konnect(event_by(maker), make_place)
      konnect(event_by(other), make_place(name: 'Bondi Beach', address: 'Bondi, Sydney', lat: -33.8915, lng: 151.2767, account: other.account))
    end

    it 'shows each member the Places they can see' do
      get '/api/v1/map/places', headers: headers_for(other)
      expect(response.parsed_body.pluck('name')).to contain_exactly('Fitzroy Gardens', 'Bondi Beach')
    end

    it 'narrows to a box, to near a point and to a search' do
      get '/api/v1/map/places', headers: headers_for(maker), params: { bbox: '144,-38,146,-37' }
      expect(response.parsed_body.pluck('name')).to eq(['Fitzroy Gardens'])

      get '/api/v1/map/places', headers: headers_for(maker), params: { near: '-33.89,151.27', radius_km: 2 }
      expect(response.parsed_body.pluck('name')).to eq(['Bondi Beach'])

      get '/api/v1/map/places', headers: headers_for(maker), params: { q: 'sydney' }
      expect(response.parsed_body.pluck('name')).to eq(['Bondi Beach'])
    end
  end

  describe 'changing a Place' do
    let!(:place) { make_place }

    it "lets its maker rename and delete it, and nobody else; one you can't see is 404" do
      patch "/api/v1/map/places/#{place.id}", headers: headers_for(other), params: { name: 'Mine now' }
      expect(response).to have_http_status(404)

      konnect(event_by(maker), place)
      patch "/api/v1/map/places/#{place.id}", headers: headers_for(other), params: { name: 'Mine now' }
      expect(response).to have_http_status(403)
      delete "/api/v1/map/places/#{place.id}", headers: headers_for(other)
      expect(response).to have_http_status(403)

      patch "/api/v1/map/places/#{place.id}", headers: headers_for(maker), params: { name: 'The Gardens' }
      expect(response).to have_http_status(200)
      expect(place.reload.name).to eq('The Gardens')

      delete "/api/v1/map/places/#{place.id}", headers: headers_for(maker)
      expect(response).to have_http_status(200)
      expect(MapPlace.exists?(place.id)).to be(false)
    end
  end

  describe 'Konnecting to a Place' do
    let!(:place) { make_place }
    let(:event) { event_by(other) }

    it "does not link to a Place the linker can't see" do
      post '/api/v1/attachments', headers: headers_for(other), params: {
        source_slug: 'kalendar', source_id: event.id, target_slug: 'map', target_id: place.id, kind: 'link'
      }
      expect(response).to have_http_status(404)
    end

    it 'lets anyone who can see it link their own record to it, shown at its page, and finds it by address in the picker' do
      konnect(event_by(maker), place)

      post '/api/v1/attachments', headers: headers_for(other), params: {
        source_slug: 'kalendar', source_id: event.id, target_slug: 'map', target_id: place.id, kind: 'link'
      }
      expect(response).to have_http_status(200)
      expect(response.parsed_body['target']).to include('title' => 'Fitzroy Gardens', 'url' => "/hub/map/places/#{place.id}")

      get '/api/v1/attachments/candidates?korner=map&q=wellington', headers: headers_for(other)
      expect(response.parsed_body).to contain_exactly(include('id' => place.id.to_s, 'title' => 'Fitzroy Gardens', 'subtitle' => 'Wellington Pde, East Melbourne'))
    end

    it 'takes the link away when the Place goes' do
      konnect(event, place)

      expect { place.destroy! }.to change(KornerAttachment, :count).by(-1)
    end
  end
end
