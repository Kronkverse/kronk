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
      # Sees it via the audience krew, but can't add photos.
      expect(album.visible_to?(member)).to be true
      expect(album.contributable_by?(member)).to be false
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

  describe 'choosing the cover' do
    let(:album) { Album.create!(owner: user.account, title: 'Trip') }

    def photo_in(album)
      media  = Fabricate(:media_attachment, account: user.account)
      status = Fabricate(:status, account: user.account, media_attachments: [media])
      AlbumPhoto.create!(album: album, contributor: user.account, status: status)
      media
    end

    it 'lets the owner pick any photo in the album' do
      photo_in(album)
      second = photo_in(album)

      put "/api/v1/albutts/albums/#{album.id}", headers: headers, params: { album: { cover_media_attachment_id: second.id } }

      expect(response).to have_http_status(200)
      expect(response.parsed_body['cover_media_attachment_id']).to eq second.id.to_s
      expect(response.parsed_body['cover_url']).to eq second.file.url(:small)
    end

    it 'refuses a photo that is not in the album' do
      photo_in(album)
      stray = photo_in(Album.create!(owner: user.account, title: 'Other'))

      put "/api/v1/albutts/albums/#{album.id}", headers: headers, params: { album: { cover_media_attachment_id: stray.id } }

      expect(response).to have_http_status(422)
      expect(album.reload.cover_media_attachment_id).to be_nil
    end

    it 'falls back to the first photo when the chosen cover is deleted' do
      photo_in(album)
      second = photo_in(album)
      album.update!(cover_media_attachment_id: second.id)

      second.destroy!
      get "/api/v1/albutts/albums/#{album.id}", headers: headers

      expect(response.parsed_body['cover_media_attachment_id']).to be_nil
      expect(response.parsed_body['cover_url']).to be_present
    end
  end

  describe 'GET /api/v1/albutts/albums/:id/download' do
    let(:album) { Album.create!(owner: user.account, title: 'Road Trip', visibility: :public) }

    def photo_in(album)
      media  = Fabricate(:media_attachment, account: user.account)
      status = Fabricate(:status, account: user.account, media_attachments: [media])
      AlbumPhoto.create!(album: album, contributor: user.account, status: status)
    end

    def zipped_names
      names = []
      Zip::InputStream.open(StringIO.new(response.body)) do |zip|
        while (entry = zip.get_next_entry)
          names << entry.name
        end
      end
      names
    end

    it 'sends every photo in the album as a zip, in order' do
      2.times { photo_in(album) }

      get "/api/v1/albutts/albums/#{album.id}/download", headers: headers

      expect(response).to have_http_status(200)
      expect(response.media_type).to eq 'application/zip'
      expect(response.headers['Content-Disposition']).to include('attachment', 'road-trip.zip')
      expect(zipped_names).to eq ["001-#{user.account.username}.jpg", "002-#{user.account.username}.jpg"]
    end

    it 'sends only the chosen photos, and none from another album' do
      photo_in(album)
      chosen = photo_in(album)
      stray  = photo_in(Album.create!(owner: user.account, title: 'Other'))

      get "/api/v1/albutts/albums/#{album.id}/download", headers: headers, params: { photo_ids: "#{chosen.id},#{stray.id}" }

      expect(response).to have_http_status(200)
      expect(zipped_names.size).to eq 1
    end

    it 'keeps the original bytes' do
      photo = photo_in(album)

      get "/api/v1/albutts/albums/#{album.id}/download", headers: headers

      original = File.binread(photo.status.media_attachments.first.file.path(:original))
      Zip::InputStream.open(StringIO.new(response.body)) do |zip|
        zip.get_next_entry
        expect(zip.read.b).to eq original
      end
    end

    it 'works for a signed-in browser with no access token' do
      photo_in(album)
      sign_in user

      get "/api/v1/albutts/albums/#{album.id}/download"

      expect(response).to have_http_status(200)
      expect(zipped_names.size).to eq 1
    end

    it 'is refused to someone who cannot see the album' do
      hidden = Album.create!(owner: Fabricate(:account), title: 'Mine', visibility: :self_only)

      get "/api/v1/albutts/albums/#{hidden.id}/download", headers: headers

      expect(response).to have_http_status(403)
    end

    it 'is refused to someone who is not signed in' do
      photo_in(album)

      get "/api/v1/albutts/albums/#{album.id}/download"

      expect(response).to have_http_status(422)
    end

    it 'answers 404 for an album with no photos' do
      get "/api/v1/albutts/albums/#{album.id}/download", headers: headers

      expect(response).to have_http_status(404)
    end

    it 'refuses a download over the size limit' do
      photo_in(album)
      stub_const('Albutts::AlbumArchive::MAX_BYTES', 1)

      get "/api/v1/albutts/albums/#{album.id}/download", headers: headers

      expect(response).to have_http_status(422)
    end

    it 'tells the album page how big each photo is' do
      photo_in(album)

      get "/api/v1/albutts/albums/#{album.id}", headers: headers

      expect(response.parsed_body['photos'].first['size']).to be_positive
    end
  end

  # Kommons "Slow Loading": the list carries no photos, and an album costs
  # the same handful of queries however many photos it holds.
  describe 'how much an album costs to load' do
    let(:album) { Album.create!(owner: user.account, title: 'Trip', visibility: 'public', contribution: 'open') }

    def add_photo
      status = Fabricate(:status, account: Fabricate(:account), visibility: :public)
      Fabricate(:media_attachment, account: status.account, status: status)
      album.photos.create!(contributor: status.account, status: status)
    end

    def queries_for(&)
      count = 0
      counter = ->(*, payload) { count += 1 unless payload[:name] == 'SCHEMA' || payload[:cached] }
      ActiveSupport::Notifications.subscribed(counter, 'sql.active_record', &)
      count
    end

    it 'lists albums with a small cover and a count, and no photos' do
      2.times { add_photo }

      get '/api/v1/albutts/albums', headers: headers

      listed = response.parsed_body.first
      expect(listed).to include('photo_count' => 2)
      expect(listed).to_not have_key('photos')
      expect(listed['cover_url']).to include('/small/')
    end

    it 'gives each photo a small picture for the grid beside the original' do
      add_photo

      get "/api/v1/albutts/albums/#{album.id}", headers: headers

      photo = response.parsed_body['photos'].first
      expect(photo['thumb_url']).to include('/small/')
      expect(photo['url']).to include('/original/')
      expect(photo['status']).to include('favourited' => false)
    end

    it 'does not ask the database more for a bigger album' do
      3.times { add_photo }
      get "/api/v1/albutts/albums/#{album.id}", headers: headers # warm up
      few = queries_for { get "/api/v1/albutts/albums/#{album.id}", headers: headers }

      9.times { add_photo }
      many = queries_for { get "/api/v1/albutts/albums/#{album.id}", headers: headers }

      expect(response.parsed_body['photos'].size).to eq 12
      expect(many).to be <= few + 2
    end
  end
end
