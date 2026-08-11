# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Albutts albums API' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let(:krew)    { Krew.create!(slug: 'squad', name: 'Squad', access: 'open') }
  let(:member)  { Fabricate(:account) }
  let(:invitee) { Fabricate(:account) }

  before { krew.krew_memberships.create!(account: member) }

  describe 'POST /api/v1/albutts/albums' do
    def created_album
      Album.find(response.parsed_body['id'])
    end

    it 'creates an open album where anyone who can see it may contribute' do
      post '/api/v1/albutts/albums', headers: headers, params: {
        album: { title: 'Trip', visibility: 'public', contribution: 'open' },
      }

      expect(response).to have_http_status(201)
      expect(response.parsed_body['contribution_open']).to be true
    end

    it 'flags a contributor krew so its members can contribute (additive)' do
      post '/api/v1/albutts/albums', headers: headers, params: {
        album: { title: 'Trip', visibility: 'mates', contribution: 'invited' },
        krew_ids: [krew.id],
        contributor_krew_ids: [krew.id],
      }

      expect(response).to have_http_status(201)
      expect(created_album.album_krews.find_by(krew_id: krew.id).for_contribution).to be true
      expect(created_album.contributable_by?(member)).to be true
      expect(response.parsed_body['contributor_krew_ids']).to eq [krew.id.to_s]
    end

    it 'adds a see-only krew that grants visibility but not contribution' do
      post '/api/v1/albutts/albums', headers: headers, params: {
        album: { title: 'Trip', visibility: 'mates', contribution: 'invited' },
        krew_ids: [krew.id],
        contributor_krew_ids: [],
      }

      album = created_album
      expect(album.album_krews.find_by(krew_id: krew.id).for_contribution).to be false
      expect(album.visible_to?(member)).to be true       # sees it via the audience krew
      expect(album.contributable_by?(member)).to be false # but can't add photos
    end

    it 'adds specific invited people to the contribution roster' do
      post '/api/v1/albutts/albums', headers: headers, params: {
        album: { title: 'Trip', visibility: 'public', contribution: 'invited' },
        contributor_account_ids: [invitee.id],
      }

      expect(created_album.contributable_by?(invitee)).to be true
      expect(response.parsed_body['invited_contributor_ids']).to eq [invitee.id.to_s]
    end

    it 'accepts a legacy contribution=krew request (its krews double as contributors)' do
      post '/api/v1/albutts/albums', headers: headers, params: {
        album: { title: 'Trip', visibility: 'krew', contribution: 'krew' },
        krew_ids: [krew.id],
      }

      expect(response).to have_http_status(201)
      album = created_album
      expect(album.visibility).to eq 'self_only' # accept-both maps krew visibility
      expect(album.album_krews.find_by(krew_id: krew.id).for_contribution).to be true
      expect(album.contributable_by?(member)).to be true
    end
  end
end
