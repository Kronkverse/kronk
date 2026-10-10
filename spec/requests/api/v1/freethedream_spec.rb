# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'FreeTheDream shared map API' do
  let(:member)  { Fabricate(:user) }
  let(:steward) { Fabricate(:moderator_user) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}", 'Content-Type' => 'application/json' }
  end

  describe 'GET /api/v1/freethedream/me' do
    it 'is 401 when signed out, which the page reads as read-only' do
      get '/api/v1/freethedream/me'
      expect(response).to have_http_status(401)
    end

    it 'says who you are and that a member is not an admin' do
      get '/api/v1/freethedream/me', headers: headers_for(member)
      expect(response.parsed_body).to eq('id' => member.account.id.to_s, 'admin' => false)
    end

    it 'makes stewards the admins' do
      get '/api/v1/freethedream/me', headers: headers_for(steward)
      expect(response.parsed_body['admin']).to be(true)
    end
  end

  describe 'PUT /api/v1/freethedream/members/me' do
    it 'saves your own document, keeping only the fields the page writes' do
      put '/api/v1/freethedream/members/me',
          params: { drops: [{ id: 'a', name: 'Garden' }], follows: [], sneaky: 'x' }.to_json,
          headers: headers_for(member)

      expect(response).to have_http_status(204)
      doc = FreethedreamDocument.find_by(kind: 'member', key: member.account.id.to_s)
      expect(doc.data.keys).to contain_exactly('drops', 'follows')
    end

    it 'refuses a body over the size cap with 413' do
      big = { logos: { a: 'x' * (FreethedreamDocument::MAX_MEMBER_BYTES + 1) } }.to_json
      put '/api/v1/freethedream/members/me', params: big, headers: headers_for(member)
      expect(response).to have_http_status(413)
    end

    it 'refuses a document the map could not render safely' do
      put '/api/v1/freethedream/members/me',
          params: { drops: [{ id: 'a', links: ['constructor'] }] }.to_json,
          headers: headers_for(member)
      expect(response).to have_http_status(422)
    end

    it 'refuses a body that is not a JSON object' do
      put '/api/v1/freethedream/members/me', params: '[1,2]', headers: headers_for(member)
      expect(response).to have_http_status(422)
    end
  end

  describe 'PUT /api/v1/freethedream/map/:doc_id' do
    it 'lets a steward write a map document' do
      put '/api/v1/freethedream/map/approved', params: { items: [] }.to_json, headers: headers_for(steward)

      expect(response).to have_http_status(204)
      expect(FreethedreamDocument.find_by(kind: 'map', key: 'approved').data).to eq('items' => [])
    end

    it 'accepts a per-project logo document' do
      put '/api/v1/freethedream/map/logo-kronk', params: { src: 'data:image/png;base64,AAAA' }.to_json, headers: headers_for(steward)
      expect(response).to have_http_status(204)
    end

    it 'forbids members' do
      put '/api/v1/freethedream/map/approved', params: { items: [] }.to_json, headers: headers_for(member)
      expect(response).to have_http_status(403)
    end

    it 'refuses map documents the page never writes' do
      put '/api/v1/freethedream/map/anything', params: {}.to_json, headers: headers_for(steward)
      expect(response).to have_http_status(404)
    end
  end

  describe 'GET /api/v1/freethedream/state' do
    it 'returns members, map documents and names' do
      FreethedreamDocument.create!(kind: 'member', key: member.account.id.to_s, data: { 'drops' => [] })
      FreethedreamDocument.create!(kind: 'map', key: 'stewards', data: { 'map' => { 'kronk' => [steward.account.id.to_s] } })

      get '/api/v1/freethedream/state', headers: headers_for(member)

      body = response.parsed_body
      expect(body['members'].keys).to eq([member.account.id.to_s])
      expect(body['map']['stewards']).to eq('map' => { 'kronk' => [steward.account.id.to_s] })
      expect(body['names'].keys).to contain_exactly(member.account.id.to_s, steward.account.id.to_s)
    end

    it 'answers 304 to an unchanged poll' do
      get '/api/v1/freethedream/state', headers: headers_for(member)
      etag = response.headers['ETag']

      get '/api/v1/freethedream/state', headers: headers_for(member).merge('If-None-Match' => etag)
      expect(response).to have_http_status(304)
    end
  end
end
