# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/art.md, Portfolio.
RSpec.describe 'Art portfolios' do
  let(:artist)  { Fabricate(:user).account }
  let(:viewer)  { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: viewer.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:own_token) { Fabricate(:accessible_access_token, resource_owner_id: artist.user.id, scopes: 'read write') }
  let(:own_headers) { { 'Authorization' => "Bearer #{own_token.token}" } }

  def piece(title, visibility: :public)
    ArtPiece.create!(owner: artist, title: title, kind: :painting, visibility: visibility)
  end

  it "shows the artist's pieces the viewer may see, with the statement and featured pieces", :aggregate_failures do
    open_piece = piece('Coastline')
    hidden = piece('Sketchbook', visibility: :self_only)
    artist.create_art_portfolio!(statement: 'I paint the coast.', open_for_commissions: true)
    open_piece.update!(featured_position: 1)

    get "/api/v1/art/portfolios/#{artist.id}", headers: headers

    body = response.parsed_body
    expect(body['pieces'].pluck('id')).to eq [open_piece.id.to_s]
    expect(body['pieces'].pluck('id')).to_not include(hidden.id.to_s)
    expect(body['featured'].pluck('id')).to eq [open_piece.id.to_s]
    expect(body).to include('statement' => 'I paint the coast.', 'open_for_commissions' => true, 'is_owner' => false)
  end

  it 'lets the artist write their statement, open for commissions, and lead with up to three of their own pieces', :aggregate_failures do
    pieces = Array.new(4) { |index| piece("Work #{index}") }
    someone_elses = ArtPiece.create!(owner: Fabricate(:account), title: 'Not mine', kind: :drawing, visibility: :public)

    put '/api/v1/art/portfolio', headers: own_headers, params: {
      statement: 'Clay and fire.', open_for_commissions: true,
      featured_ids: [pieces[2].id, someone_elses.id, pieces[0].id, pieces[1].id, pieces[3].id].map(&:to_s)
    }

    expect(response).to have_http_status(200)
    expect(artist.art_portfolio.reload).to have_attributes(statement: 'Clay and fire.', open_for_commissions: true)
    expect(ArtPortfolio.featured_pieces_of(artist).map(&:id)).to eq [pieces[2].id, pieces[0].id, pieces[1].id]
    expect(someone_elses.reload.featured_position).to be_nil
  end

  it 'keeps the mediums an artist works in, tidied, and says when a portfolio is set up', :aggregate_failures do
    get "/api/v1/art/portfolios/#{artist.id}", headers: own_headers
    expect(response.parsed_body).to include('set_up' => false, 'mediums' => [])

    put '/api/v1/art/portfolio', headers: own_headers, params: { mediums: [' Ceramics ', 'Oil', 'ceramics', ''] }

    expect(response.parsed_body).to include('set_up' => true, 'mediums' => %w(Ceramics Oil))
  end
end
