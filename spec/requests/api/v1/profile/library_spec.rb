# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Profile Library API' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:accounts') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/profile/library' do
    it 'returns http success' do
      get '/api/v1/profile/library', headers: headers
      expect(response).to have_http_status(200)
    end

    it 'lists every ProfileCard::CARD_TYPES under told' do
      get '/api/v1/profile/library', headers: headers
      told = response.parsed_body['told']
      types = told.pluck('card_type')
      expect(types).to match_array(ProfileCard::CARD_TYPES)
    end

    it 'marks already-added card_types' do
      Fabricate(:profile_card, account: user.account, card_type: 'about', position: 0)
      get '/api/v1/profile/library', headers: headers
      told = response.parsed_body['told']
      about = told.find { |t| t['card_type'] == 'about' }
      expect(about['already_added']).to be true
    end

    it 'returns a drawn list' do
      get '/api/v1/profile/library', headers: headers
      expect(response.parsed_body['drawn']).to be_an(Array)
    end

    it 'offers a shelf of the photos you are tagged in, counted', :aggregate_failures do
      poster = Fabricate(:account)
      album = Album.create!(owner: poster, title: 'Doof', visibility: :public)
      status = Fabricate(:status, account: poster)
      AlbumPhoto.create!(album: album, status: status, contributor: poster)
      Fabricate(:mention, status: status, account: user.account)

      get '/api/v1/profile/library', headers: headers

      tagged = response.parsed_body['drawn'].find { |preset| preset['key'] == 'albutts:tagged' }
      expect(tagged).to include('korner_slug' => 'albutts', 'source' => 'tagged', 'count' => 1, 'already_added' => false)
    end
  end
end
