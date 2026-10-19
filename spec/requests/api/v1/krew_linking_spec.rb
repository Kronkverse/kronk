# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/krew.md, Linking: an album or event you already made can be
# linked to a Krew you're in. Its members then see it, posts included, and
# it shows on the Krew's page.
RSpec.describe 'Linking albums and events to a Krew' do
  let(:author)   { Fabricate(:user) }
  let(:member)   { Fabricate(:user) }
  let(:stranger) { Fabricate(:user) }
  let(:krew)     { Krew.create!(slug: 'gardeners', name: 'Gardeners', access: 'open') }
  let(:other)    { Krew.create!(slug: 'knitters', name: 'Knitters', access: 'open') }

  before do
    krew.krew_memberships.create!(account: author.account)
    krew.krew_memberships.create!(account: member.account)
    other.krew_memberships.create!(account: stranger.account)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def make_album
    post '/api/v1/albutts/albums', headers: headers_for(author), params: { album: { title: 'Seed swap', visibility: 'self_only', contribution: 'open' } }
    album = Album.find(response.parsed_body['id'])
    media = Fabricate(:media_attachment, account: author.account, status: nil)
    post "/api/v1/albutts/albums/#{album.id}/photos", headers: headers_for(author), params: { photo: { media_id: media.id } }
    expect(response).to have_http_status(201)
    album
  end

  describe 'an album' do
    it 'reaches the Krew, its posts too, and shows on the Krew page' do
      album = make_album
      expect(album.visible_to?(member.account)).to be(false)

      post "/api/v1/albutts/albums/#{album.id}/krews", headers: headers_for(author), params: { krew_id: krew.id }
      expect(response).to have_http_status(200)

      expect(album.reload.visible_to?(member.account)).to be(true)
      photo_status = album.photos.first.status
      expect(photo_status.krews).to include(krew)
      expect(StatusPolicy.new(member.account, photo_status).show?).to be(true)

      get '/api/v1/albutts/albums', headers: headers_for(member), params: { krew_id: krew.id }
      expect(response.parsed_body.pluck('id')).to eq([album.id.to_s])
    end

    it 'unlinks, posts included' do
      album = make_album
      post "/api/v1/albutts/albums/#{album.id}/krews", headers: headers_for(author), params: { krew_id: krew.id }
      delete "/api/v1/albutts/albums/#{album.id}/krews/#{krew.id}", headers: headers_for(author)

      expect(album.reload.visible_to?(member.account)).to be(false)
      expect(album.photos.first.status.krews).to be_empty
    end

    it 'follows Krews added in the edit form' do
      album = make_album
      put "/api/v1/albutts/albums/#{album.id}", headers: headers_for(author), params: { album: { title: 'Seed swap' }, krew_ids: [krew.id] }

      expect(response).to have_http_status(200)
      expect(album.photos.first.status.krews).to include(krew)
    end

    it "takes only the owner, and only a Krew they're in" do
      album = make_album

      post "/api/v1/albutts/albums/#{album.id}/krews", headers: headers_for(author), params: { krew_id: other.id }
      expect(response).to have_http_status(404)
      post "/api/v1/albutts/albums/#{album.id}/krews", headers: headers_for(member), params: { krew_id: krew.id }
      expect(response).to have_http_status(404)
      expect(album.album_krews).to be_empty
    end
  end

  describe 'an event' do
    def make_event(**params)
      post '/api/v1/events', headers: headers_for(author), params: { title: 'Working bee', start_time: 2.days.from_now.iso8601, visibility: 'self_only', **params }
      Event.find(response.parsed_body['id'])
    end

    it 'reaches the Krew, past events included, and shows on the Krew page' do
      event = make_event
      event.update_columns(start_time: 3.days.ago)
      expect(event.visible_to?(member.account)).to be(false)

      post "/api/v1/events/#{event.id}/krews", headers: headers_for(author), params: { krew_id: krew.id }
      expect(response).to have_http_status(200)
      expect(event.reload.visible_to?(member.account)).to be(true)

      get '/api/v1/events', headers: headers_for(member), params: { krew_id: krew.id, filter: 'past' }
      expect(response.parsed_body.pluck('id')).to eq([event.id.to_s])

      delete "/api/v1/events/#{event.id}/krews/#{krew.id}", headers: headers_for(author)
      expect(event.reload.visible_to?(member.account)).to be(false)
    end

    it "can't link an invite-only event, or someone else's" do
      invite_only = make_event(invite_only: true)
      post "/api/v1/events/#{invite_only.id}/krews", headers: headers_for(author), params: { krew_id: krew.id }
      expect(response).to have_http_status(422)

      event = make_event
      post "/api/v1/events/#{event.id}/krews", headers: headers_for(member), params: { krew_id: krew.id }
      expect(response).to have_http_status(404)
    end
  end
end
