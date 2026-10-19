# frozen_string_literal: true

require 'rails_helper'

# Medium privacy fixes from the 2026-10-15 audit: who may see a trek, a
# photo's tags, a draft listing or a Krew chat; whose uploads and Krews a
# record may use; what the Kommunity orb shows.
RSpec.describe 'Reach and ownership' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def mate!(one, two)
    one.account.follow!(two.account)
    two.account.follow!(one.account)
  end

  describe 'treks' do
    def published_trek(visibility)
      trek = Trek.create!(account: alice.account, recorded_at: Time.zone.now)
      post "/api/v1/map/treks/#{trek.id}/publish", params: { visibility: visibility }, headers: headers_for(alice)
      expect(response).to have_http_status(200)
      trek
    end

    it 'keeps a Just me trek from a Mate' do
      mate!(alice, bob)
      trek = published_trek('self_only')

      get "/api/v1/map/treks/#{trek.id}", headers: headers_for(bob)
      expect(response).to have_http_status(404)

      get '/api/v1/map/treks', headers: headers_for(bob)
      expect(response.parsed_body.pluck(:id)).to_not include(trek.id.to_s)
    end

    it 'opens a trek published to everyone for a non-Mate' do
      trek = published_trek('public')

      get "/api/v1/map/treks/#{trek.id}", headers: headers_for(bob)
      expect(response).to have_http_status(200)
    end
  end

  describe 'tags on a photo' do
    it 'are not listed for a photo on a post the viewer cannot see' do
      status = Fabricate(:status, account: alice.account, visibility: :self_only)
      media = Fabricate(:media_attachment, account: alice.account, status: status)
      MediaTag.create!(media_attachment: media, account: Fabricate(:account), created_by_account: alice.account, x: 0.5, y: 0.5)

      get "/api/v1/media/#{media.id}/tags", headers: headers_for(bob)

      expect(response).to have_http_status(404)
    end
  end

  describe 'uploads and Krews on a record' do
    let(:bobs_photo) { Fabricate(:media_attachment, account: bob.account) }

    it "refuses someone else's photo as a kar's cover" do
      kar = Kar.new(owner: alice.account, title: 'Ute', make: 'Holden', model: 'HQ', year: 1972, cover_media_attachment: bobs_photo)

      expect(kar).to_not be_valid
    end

    it "refuses someone else's photo on a Moment" do
      moment = Moment.new(account: alice.account, media_attachment: bobs_photo, visibility: :mates)

      expect(moment).to_not be_valid
    end

    it "refuses a Krew the Moment's author isn't in" do
      krew = Krew.create!(slug: 'secret', name: 'Secret', access: 'invite_only')
      moment = Moment.new(account: alice.account, media_attachment: Fabricate(:media_attachment, account: alice.account), visibility: :mates, krew: krew)

      expect(moment).to_not be_valid
    end
  end

  describe 'an album aimed at a Krew' do
    it "drops a Krew its owner isn't in" do
      krew = Krew.create!(slug: 'hidden', name: 'Hidden', access: 'invite_only')

      post '/api/v1/albutts/albums', params: { album: { title: 'Trip', visibility: 'mates' }, krew_ids: [krew.id] }, headers: headers_for(alice)

      expect(response).to have_http_status(201)
      expect(AlbumKrew.where(krew_id: krew.id)).to_not exist
    end
  end

  describe 'draft listings' do
    it "are their owner's alone" do
      listing = Listing.create!(account: alice.account, title: 'Bike', category: 'goods', state: 'draft')

      get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers_for(bob)

      expect(response).to have_http_status(404)
    end
  end

  describe 'a pending Krew-chat invite' do
    let(:krew) { Krew.create!(slug: 'growers', name: 'Growers', access: 'open') }

    before { krew.krew_memberships.create!(account: alice.account, role: 'seeder', source: 'direct') }

    it 'can be accepted, but the chat stays closed until it is' do
      conversation = Nudges::Conversation.invite_to_krew!(krew, bob.account, alice.account)

      get "/api/v1/nudges/conversations/#{conversation.id}", headers: headers_for(bob)
      expect(response).to have_http_status(404)

      post "/api/v1/nudges/conversations/#{conversation.id}/accept_invite", headers: headers_for(bob)
      expect(response).to have_http_status(200)

      get "/api/v1/nudges/conversations/#{conversation.id}", headers: headers_for(bob)
      expect(response).to have_http_status(200)
    end

    it "isn't sent to someone who blocked the inviter when a Krew is made" do
      bob.account.block!(alice.account)

      post '/api/v1/krews', params: { slug: 'cooks', name: 'Cooks', access: 'open', invite_account_ids: [bob.account.id] }, headers: headers_for(alice)

      expect(Nudges::ConversationMembership.where(account_id: bob.account.id)).to_not exist
    end
  end

  describe 'Kommunity orb' do
    before do
      Api::V1::Kommunity::OrbController.bust_cache!
      [alice, bob].each { |u| u.update!(current_sign_in_at: Time.current) }
    end

    it 'leaves out someone who chose not to be found, and the lines of someone who hides their Mates' do
      carol = Fabricate(:user, current_sign_in_at: Time.current)
      carol.account.update!(kommunity_discoverability: :nobody)
      bob.account.update!(hide_collections: true)
      mate!(alice, bob)

      get '/api/v1/kommunity/orb', headers: headers_for(alice)

      ids = response.parsed_body[:accounts].pluck(:id)
      expect(ids).to include(alice.account.id.to_s, bob.account.id.to_s)
      expect(ids).to_not include(carol.account.id.to_s)
      expect(response.parsed_body[:follows]).to be_empty
    end
  end

  describe 'album captions' do
    it "can't be rewritten by the album's owner" do
      album = Album.create!(owner: alice.account, title: 'Trip', visibility: :public)
      status = Fabricate(:status, account: bob.account, text: 'my words')
      Fabricate(:media_attachment, account: bob.account, status: status)
      photo = AlbumPhoto.create!(album: album, contributor: bob.account, status: status)

      put "/api/v1/albutts/photos/#{photo.id}", params: { photo: { caption: 'your words' } }, headers: headers_for(alice)

      expect(response).to have_http_status(403)
      expect(status.reload.text).to eq 'my words'
    end
  end
end
