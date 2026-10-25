# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Art photos' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:piece)   { ArtPiece.create!(owner: user.account, title: 'Let it ride', kind: :painting, visibility: :public) }

  describe 'POST /api/v1/art/pieces/:piece_id/photos' do
    it 'adds the owner’s upload to the piece' do
      media = Fabricate(:media_attachment, account: user.account)

      post "/api/v1/art/pieces/#{piece.id}/photos", params: { photo: { media_id: media.id, position: 0 } }, headers: headers

      expect(response).to have_http_status(201)
      expect(piece.photos.pluck(:media_attachment_id)).to eq [media.id]
      expect(response.parsed_body[:url]).to be_present
    end

    it 'refuses someone else’s upload' do
      media = Fabricate(:media_attachment, account: Fabricate(:account))

      post "/api/v1/art/pieces/#{piece.id}/photos", params: { photo: { media_id: media.id } }, headers: headers

      expect(response).to have_http_status(422)
      expect(piece.photos).to be_empty
    end

    it 'refuses a piece that isn’t yours' do
      theirs = ArtPiece.create!(owner: Fabricate(:account), title: 'Not mine', kind: :drawing, visibility: :public)
      media = Fabricate(:media_attachment, account: user.account)

      post "/api/v1/art/pieces/#{theirs.id}/photos", params: { photo: { media_id: media.id } }, headers: headers

      expect(response).to have_http_status(403)
      expect(theirs.photos).to be_empty
    end
  end
end
