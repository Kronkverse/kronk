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

    # docs/spaces/art.md, Piece details.
    it 'keeps what the piece is made of, its size, year, edition and status', :aggregate_failures do
      post '/api/v1/art/pieces', headers: headers, params: { art_piece: {
        title: 'Coastline at dusk', kind: 'painting', visibility: 'public',
        medium: 'Oil on linen', width: '60', height: '90', depth: '', size_unit: 'cm',
        year_made: '2026', edition: 'Original', availability: 'available'
      } }

      expect(response).to have_http_status(201)
      expect(response.parsed_body).to include(
        'medium' => 'Oil on linen', 'width' => 60.0, 'height' => 90.0, 'depth' => nil,
        'size_unit' => 'cm', 'year_made' => 2026, 'edition' => 'Original', 'availability' => 'available'
      )
    end

    it 'refuses a size unit it does not know' do
      post '/api/v1/art/pieces', headers: headers, params: { art_piece: { title: 'Pot', kind: 'ceramic', visibility: 'public', size_unit: 'ft' } }

      expect(response).to have_http_status(422)
    end

    # docs/spaces/art.md, Mediums: a piece's mediums join its artist's
    # portfolio mediums.
    it 'puts the piece in the mediums picked, and adds a new one to the portfolio', :aggregate_failures do
      user.account.create_art_portfolio!(mediums: %w(Ceramics))

      post '/api/v1/art/pieces', headers: headers, params: { art_piece: {
        title: 'Moon jar', kind: 'ceramic', visibility: 'public', mediums: ['Ceramics', ' Raku ', 'ceramics']
      } }

      expect(response).to have_http_status(201)
      expect(response.parsed_body['mediums']).to eq %w(Ceramics Raku)
      expect(user.account.art_portfolio.reload.mediums).to eq %w(Ceramics Raku)
    end
  end
end
