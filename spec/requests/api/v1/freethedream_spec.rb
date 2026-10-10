# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'FreeTheDream shared map API' do
  let(:member)  { Fabricate(:user) }
  let(:helper)  { Fabricate(:user) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}", 'Content-Type' => 'application/json' }
  end

  describe 'GET /api/v1/freethedream/me' do
    it 'is 401 when signed out, which the page reads as read-only' do
      get '/api/v1/freethedream/me'
      expect(response).to have_http_status(401)
    end

    it 'says who you are (the open map has no admins)' do
      get '/api/v1/freethedream/me', headers: headers_for(member)
      expect(response.parsed_body).to eq('id' => member.account.id.to_s, 'admin' => false)
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

  describe 'GET /api/v1/freethedream/state' do
    it 'returns everyone’s documents as you may see them, with names' do
      creator = member.account.id.to_s
      FreethedreamDocument.create!(kind: 'member', key: creator, data: { 'drops' => [{ 'id' => 'choir', 'open' => false, 'runners' => [] }] })
      FreethedreamDocument.create!(kind: 'member', key: helper.account.id.to_s, data: { 'claims' => ["#{creator}~choir"] })

      get '/api/v1/freethedream/state', headers: headers_for(member)

      body = response.parsed_body
      expect(body['map']).to eq({})
      expect(body['names'].keys).to contain_exactly(creator, helper.account.id.to_s)
      # The creator sees the request to help run their project…
      expect(body.dig('members', helper.account.id.to_s, 'claims')).to eq(["#{creator}~choir"])

      # …and someone else doesn't.
      get '/api/v1/freethedream/state', headers: headers_for(Fabricate(:user))
      expect(response.parsed_body.dig('members', helper.account.id.to_s, 'claims')).to eq([])
    end

    it 'answers 304 to an unchanged poll' do
      get '/api/v1/freethedream/state', headers: headers_for(member)
      etag = response.headers['ETag']

      get '/api/v1/freethedream/state', headers: headers_for(member).merge('If-None-Match' => etag)
      expect(response).to have_http_status(304)
    end
  end
end
