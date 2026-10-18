# frozen_string_literal: true

require 'rails_helper'

# Krew albums (docs/spaces/albutts.md, Krew albums; decisions.md 2026-10-17):
# an album that belongs to a Krew. Any member edits it and adds to it,
# nobody deletes it alone, and a personal album can be given to a Krew.
RSpec.describe 'API V1 Albutts Krew albums' do
  let(:maker)    { Fabricate(:user) }
  let(:member)   { Fabricate(:user) }
  let(:outsider) { Fabricate(:user) }

  let(:krew) do
    Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: maker.account, last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: maker.account, role: 'seeder', source: 'direct')
      k.krew_memberships.create!(account: member.account, role: 'member', source: 'direct')
    end
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def make_album(audience: 'krew', as: maker)
    post '/api/v1/albutts/albums', headers: headers_for(as), params: { krew_id: krew.id, audience: audience, album: { title: 'Harvest' } }
    Album.find(response.parsed_body['id'])
  end

  describe 'making one' do
    it 'belongs to the Krew, is seen by its members only, and any member can add' do
      album = make_album

      expect(response).to have_http_status(201)
      expect(response.parsed_body).to include('krew_id' => krew.id.to_s, 'audience' => 'krew')
      expect(album.status.visibility).to eq 'self_only'
      expect(album.visible_to?(member.account)).to be true
      expect(album.visible_to?(outsider.account)).to be false
      expect(album.contributable_by?(member.account)).to be true
    end

    it "shows in the member's Albutts list with its Krew's name" do
      album = make_album

      get '/api/v1/albutts/albums', headers: headers_for(member)

      card = response.parsed_body.find { |a| a['id'] == album.id.to_s }
      expect(card).to include('krew_id' => krew.id.to_s, 'krew_name' => 'Growers')
    end

    it 'can be seen by everyone, but only members add' do
      album = make_album(audience: 'everyone')

      expect(album.status.visibility).to eq 'public'
      expect(album.visible_to?(outsider.account)).to be true
      expect(album.contributable_by?(outsider.account)).to be false
    end

    it 'cannot be shown to everyone from a Krew hidden from Discover' do
      krew.update!(access: 'invite_only', invite_token: 'letmein')

      post '/api/v1/albutts/albums', headers: headers_for(maker), params: { krew_id: krew.id, audience: 'everyone', album: { title: 'Harvest' } }

      expect(response).to have_http_status(422)
    end

    it 'needs you to be in the Krew' do
      post '/api/v1/albutts/albums', headers: headers_for(outsider), params: { krew_id: krew.id, album: { title: 'Harvest' } }

      expect(response).to have_http_status(404)
    end
  end

  describe 'editing' do
    it 'lets any member rename it' do
      album = make_album

      put "/api/v1/albutts/albums/#{album.id}", headers: headers_for(member), params: { album: { title: 'Harvest 2026' } }

      expect(response).to have_http_status(200)
      expect(album.reload.title).to eq 'Harvest 2026'
    end

    it 'turns away someone outside the Krew' do
      album = make_album(audience: 'everyone')

      put "/api/v1/albutts/albums/#{album.id}", headers: headers_for(outsider), params: { album: { title: 'Mine now' } }

      expect(response).to have_http_status(403)
    end

    it 'moves the posts it already has when a member narrows who sees it' do
      album = make_album(audience: 'everyone')

      put "/api/v1/albutts/albums/#{album.id}", headers: headers_for(member), params: { audience: 'krew' }

      expect(response).to have_http_status(200)
      expect(album.reload.audience).to eq 'krew'
      expect(album.status.reload.visibility).to eq 'self_only'
      expect(album.visible_to?(outsider.account)).to be false
    end

    it 'takes the card out of the feeds of followers who can no longer see it' do
      follower = Fabricate(:account)
      follower.follow!(maker.account)
      album = make_album(audience: 'everyone')
      FeedManager.instance.push_to_home(follower, album.status)
      FeedManager.instance.push_to_home(member.account, album.status)

      put "/api/v1/albutts/albums/#{album.id}", headers: headers_for(member), params: { audience: 'krew' }

      expect(HomeFeed.new(follower).get(10).map(&:id)).to_not include(album.status_id)
      expect(HomeFeed.new(member.account).get(10).map(&:id)).to include(album.status_id)
    end
  end

  describe 'deleting' do
    it 'is refused while anyone else is in the Krew, its maker included' do
      album = make_album

      delete "/api/v1/albutts/albums/#{album.id}", headers: headers_for(maker)

      expect(response).to have_http_status(403)
      expect(Album.exists?(album.id)).to be true
    end

    it "lets a Krew's sole member delete it" do
      album = make_album
      krew.krew_memberships.where(account: member.account).destroy_all

      delete "/api/v1/albutts/albums/#{album.id}", headers: headers_for(maker)

      expect(response).to have_http_status(200)
      expect(Album.exists?(album.id)).to be false
    end
  end

  describe 'giving a personal album to a Krew' do
    let(:album) { Album.create!(owner: maker.account, title: 'Trip', visibility: 'mates', contribution: 'open') }

    it 'makes it a Krew album, seen by the Krew' do
      post "/api/v1/albutts/albums/#{album.id}/give", headers: headers_for(maker), params: { krew_id: krew.id }

      expect(response).to have_http_status(200)
      expect(album.reload).to have_attributes(krew_id: krew.id, audience: 'krew')
      expect(album.contributable_by?(member.account)).to be true
    end

    it 'is only for the owner of the album' do
      post "/api/v1/albutts/albums/#{album.id}/give", headers: headers_for(member), params: { krew_id: krew.id }

      expect(response).to have_http_status(403)
    end

    it 'cannot be undone by giving it again' do
      post "/api/v1/albutts/albums/#{album.id}/give", headers: headers_for(maker), params: { krew_id: krew.id }
      post "/api/v1/albutts/albums/#{album.id}/give", headers: headers_for(maker), params: { krew_id: krew.id }

      expect(response).to have_http_status(403)
    end
  end

  describe 'photos and asking' do
    it 'lets nobody but the contributor remove a photo' do
      album = make_album
      status = PostStatusService.new.call(member.account, text: 'Beans', visibility: 'self_only')
      photo = album.photos.create!(contributor: member.account, status: status)

      delete "/api/v1/albutts/photos/#{photo.id}", headers: headers_for(maker)
      expect(response).to have_http_status(403)

      delete "/api/v1/albutts/photos/#{photo.id}", headers: headers_for(member)
      expect(response).to have_http_status(200)
    end

    it 'sends people who want to add to the Krew instead of taking requests' do
      album = make_album(audience: 'everyone')

      post "/api/v1/albutts/albums/#{album.id}/contribution_requests", headers: headers_for(outsider)

      expect(response).to have_http_status(422)
      expect(response.parsed_body['error']).to eq 'join_the_krew'
    end
  end
end
