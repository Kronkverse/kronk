# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Art pieces' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'POST /api/v1/art/pieces' do
    # docs/spaces/art.md, Kind: the kinds past the first seven.
    it 'takes a textile piece' do
      post '/api/v1/art/pieces', params: { art_piece: { title: 'Wall hanging', kind: 'textile', visibility: 'public' } }, headers: headers

      expect(response).to have_http_status(201)
      expect(response.parsed_body[:kind]).to eq 'textile'
      expect(ArtPiece.last).to be_textile_kind
    end
  end
end
