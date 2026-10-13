# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/albutts.md, Tagging people.
RSpec.describe 'Albutts tagging', :inline_jobs do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let!(:ana)    { Fabricate(:user, account_attributes: { username: 'ana' }).account }

  def tagged(account)
    Nudges::Event.where(recipient_account_id: account.id, source_korner_slug: 'albutts', verb: 'tagged')
  end

  def create_album(description, visibility: 'public')
    post '/api/v1/albutts/albums', headers: headers, params: { album: { title: 'Trip', visibility: visibility, description: description } }
    Album.find(response.parsed_body['id'])
  end

  describe 'an @name in an album description' do
    it 'tells that person, once, and not again when the album is edited' do
      album = create_album('With @ana and @nobody at the coast')
      expect(tagged(ana).count).to eq 1

      put "/api/v1/albutts/albums/#{album.id}", headers: headers, params: { album: { description: 'With @ana at the coast, day two' } }
      expect(tagged(ana).count).to eq 1
    end

    it 'tells someone named later, when the description is edited' do
      album = create_album('At the coast')
      expect(tagged(ana)).to be_empty

      put "/api/v1/albutts/albums/#{album.id}", headers: headers, params: { album: { description: 'At the coast with @Ana' } }
      expect(tagged(ana).count).to eq 1
    end

    it 'does not tell someone who cannot open the album, or yourself' do
      create_album("Just for me, @ana and @#{user.account.username}", visibility: 'self_only')

      expect(tagged(ana)).to be_empty
      expect(tagged(user.account)).to be_empty
    end
  end

  describe 'an @name in a photo caption' do
    it 'tells that person they were tagged, and leads to the album' do
      album = create_album('Coast')
      media = Fabricate(:media_attachment, account: user.account, status: nil)

      post "/api/v1/albutts/albums/#{album.id}/photos", headers: headers, params: { photo: { media_id: media.id, caption: '@ana on the rocks' } }

      expect(response).to have_http_status(201).or have_http_status(200)
      expect(tagged(ana).pick(:cta_route)).to eq "/hub/albutts/albums/#{album.id}"
    end
  end
end
