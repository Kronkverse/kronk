# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/albutts.md, Tagging people.
RSpec.describe 'Albutts tagging', :inline_jobs do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let!(:ana)    { Fabricate(:user, account_attributes: { username: 'ana' }).account }
  let!(:bo)     { Fabricate(:user, account_attributes: { username: 'bo' }).account }

  # Only Mates are told (Tal 2026-10-29): ana is one, bo isn't.
  before do
    user.account.follow!(ana)
    ana.follow!(user.account)
  end

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

    it 'does not tell someone who is not your Mate' do
      create_album('With @bo at the coast')

      expect(tagged(bo)).to be_empty
    end

    it 'does not tell someone who cannot open the album, or yourself' do
      create_album("Just for me, @ana and @#{user.account.username}", visibility: 'self_only')

      expect(tagged(ana)).to be_empty
      expect(tagged(user.account)).to be_empty
    end
  end

  describe 'an @name in a photo caption' do
    def photo_tags(account)
      Nudges::Event.where(recipient_account_id: account.id, source_korner_slug: 'albutts', verb: 'tagged_photo')
    end

    def add_photo(album, caption)
      media = Fabricate(:media_attachment, account: user.account, status: nil)
      post "/api/v1/albutts/albums/#{album.id}/photos", headers: headers, params: { photo: { media_id: media.id, caption: caption } }
      expect(response).to have_http_status(201)
      AlbumPhoto.find(response.parsed_body['id'])
    end

    it 'tells that person they were tagged, and leads to the photo' do
      album = create_album('Coast')

      photo = add_photo(album, '@ana on the rocks')

      expect(photo_tags(ana).sole).to have_attributes(times: 1, cta_route: "/hub/albutts/albums/#{album.id}?photo=#{photo.id}")
    end

    it 'sends one nudge, and one push, for a photo drop that tags them several times' do
      album = create_album('Northern Rivers')
      allow(Nudges::PushWorker).to receive(:perform_async)

      add_photo(album, '@ana on the rocks')
      travel(2.minutes) { add_photo(album, 'Swimming, @ana') }
      travel(4.minutes) { add_photo(album, '@ana again') }

      expect(photo_tags(ana).sole).to have_attributes(times: 3, cta_route: "/hub/albutts/albums/#{album.id}")
      expect(Nudges::PushWorker).to have_received(:perform_async).with('event', photo_tags(ana).sole.id).once
    end

    it 'starts a new nudge for a later photo drop' do
      album = create_album('Coast')

      add_photo(album, '@ana on the rocks')
      travel(Albutts::PublishPhotoBatch::QUIET + 1.minute) { add_photo(album, '@ana, the next day') }

      expect(photo_tags(ana).count).to eq 2
    end

    it 'does not tell someone who is not your Mate' do
      album = create_album('Coast')

      add_photo(album, '@bo on the rocks')

      expect(photo_tags(bo)).to be_empty
    end

    it 'keeps a tag in the album description apart' do
      album = create_album('With @ana at the coast')

      add_photo(album, '@ana on the rocks')

      expect(tagged(ana).count).to eq 1
      expect(photo_tags(ana).count).to eq 1
    end
  end
end
