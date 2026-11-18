# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Map live location from Anthemos' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:ana)     { Fabricate(:account, username: 'ana') }
  let(:ana_headers) do
    ana_user = Fabricate(:user, account: ana)
    { 'Authorization' => "Bearer #{Fabricate(:accessible_access_token, resource_owner_id: ana_user.id, scopes: 'read write').token}" }
  end
  let(:key)     { OpenSSL::PKey::EC.generate('prime256v1') }
  let(:public_key) { Base64.strict_encode64(key.public_to_der) }
  let(:events)  { [] }

  def sign(*parts, with: key)
    Base64.strict_encode64(with.sign('SHA256', parts.map(&:to_s).join("\n")))
  end

  def link!
    post '/api/v1/anthemos/links', headers: headers,
                                   params: { public_key: public_key, device_name: 'Pixel 8', signature: sign('anthemos-link-v1', me.id, public_key) }
    response.parsed_body[:id]
  end

  def share!(link_id, ids, expires = 1.hour.from_now.to_i)
    post '/api/v1/map/live', headers: headers,
                             params: { link_id: link_id, recipient_ids: ids, expires_at: expires.to_s,
                                       signature: sign('anthemos-share-v1', link_id, ids.sort.join(','), expires) }
    response.parsed_body[:id]
  end

  def point!(share_id, lat: '-33.867800', lng: '151.207000', accuracy: '12', at: Time.current.to_i.to_s, signature: nil)
    put "/api/v1/map/live/#{share_id}/point", headers: headers,
                                              params: { lat: lat, lng: lng, accuracy: accuracy, at: at,
                                                        signature: signature || sign('anthemos-live-v1', share_id, lat, lng, accuracy, at) }
  end

  before do
    allow(Kronk::KornerEvents).to receive(:publish) { |name, **payload| events << [name, payload] }
    me.follow!(ana)
    ana.follow!(me)
  end

  describe 'linking a phone' do
    it 'takes a key the phone proves it holds' do
      expect(link!).to be_present
      expect(AnthemosLink.find_by(account: me).device_name).to eq('Pixel 8')
    end

    it 'refuses a key signed by something else' do
      post '/api/v1/anthemos/links', headers: headers,
                                     params: { public_key: public_key, device_name: 'Pixel 8',
                                               signature: sign('anthemos-link-v1', me.id, public_key, with: OpenSSL::PKey::EC.generate('prime256v1')) }

      expect(response).to have_http_status(422)
      expect(AnthemosLink.count).to eq(0)
    end
  end

  describe 'sharing' do
    let!(:link_id) { link! }

    it 'shows the exact point to the Mate named, signed, and tells them' do
      share_id = share!(link_id, [ana.id])
      point!(share_id)
      expect(response).to have_http_status(204)

      get '/api/v1/map/live', headers: ana_headers
      row = response.parsed_body.sole
      expect(row).to include(account_id: me.id.to_s, lat: -33.8678, lng: 151.207, accuracy: 12, signed: true)
      expect(events).to eq([['map.live.started', { actor_account_id: me.id, recipient_account_id: ana.id }]])
    end

    it 'shows nothing to a Mate who was not named' do
      bo = Fabricate(:account, username: 'bo')
      bo_user = Fabricate(:user, account: bo)
      me.follow!(bo)
      bo.follow!(me)
      point!(share!(link_id, [ana.id]))

      get '/api/v1/map/live', headers: { 'Authorization' => "Bearer #{Fabricate(:accessible_access_token, resource_owner_id: bo_user.id, scopes: 'read').token}" }
      expect(response.parsed_body).to eq([])
    end

    it 'can only name Mates' do
      stranger = Fabricate(:account, username: 'stranger')
      share!(link_id, [stranger.id])

      expect(response).to have_http_status(422)
      expect(LiveShare.count).to eq(0)
    end

    it 'refuses a point that was not signed by the phone' do
      share_id = share!(link_id, [ana.id])
      point!(share_id, signature: sign('anthemos-live-v1', share_id, '1.0', '2.0', '5', Time.current.to_i))

      expect(response).to have_http_status(422)
    end

    it 'refuses a point older than the last one' do
      share_id = share!(link_id, [ana.id])
      point!(share_id, at: Time.current.to_i.to_s)
      point!(share_id, at: 1.minute.ago.to_i.to_s)

      expect(response).to have_http_status(422)
    end

    it 'refuses a share longer than a day' do
      share!(link_id, [ana.id], 2.days.from_now.to_i)

      expect(response).to have_http_status(422)
    end

    it 'ends at its time' do
      point!(share!(link_id, [ana.id]))

      travel_to(2.hours.from_now) do
        get '/api/v1/map/live', headers: ana_headers
        expect(response.parsed_body).to eq([])
      end
    end

    it 'stops at once, point and all' do
      share_id = share!(link_id, [ana.id])
      point!(share_id)
      delete "/api/v1/map/live/#{share_id}", headers: headers

      expect(response).to have_http_status(204)
      expect(redis.get("map:live:#{share_id}")).to be_nil
      get '/api/v1/map/live', headers: ana_headers
      expect(response.parsed_body).to eq([])
    end

    it 'stops every share when the phone is unlinked' do
      share_id = share!(link_id, [ana.id])
      point!(share_id)
      delete "/api/v1/anthemos/links/#{link_id}", headers: headers

      expect(response).to have_http_status(204)
      expect(LiveShare.count).to eq(0)
      expect(redis.get("map:live:#{share_id}")).to be_nil
    end

    it 'lists your own shares with who sees them' do
      share!(link_id, [ana.id])
      get '/api/v1/map/live/mine', headers: headers

      expect(response.parsed_body.sole[:recipients].map { |r| r[:handle] }).to eq(['ana'])
    end
  end

  it 'routes the start to a notification that opens the Map on them' do
    entry = Kronk::KornerRegistry.find('nudges').listens.find { |e| e.is_a?(Hash) && e['event'] == 'map.live.started' }

    expect(entry).to include('source_korner' => 'map', 'verb' => 'live_shared', 'cta_route' => '/hub/map?live={actor_account_id}')
  end
end
