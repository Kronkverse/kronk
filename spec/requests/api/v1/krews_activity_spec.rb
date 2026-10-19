# frozen_string_literal: true

require 'rails_helper'

# GET /api/v1/krews/:id/activity — what's happening at the top of the Krew
# page: the last few things done in it, and the viewer's unread chat count.
RSpec.describe 'API V1 Krews activity' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:tomas)   { Fabricate(:account, username: 'tomas') }
  let(:krew) do
    Krew.create!(slug: 'growers', name: 'Growers', access: 'open',
                 seeded_by: user.account, last_activity_at: Time.current)
  end

  def add_photos(album, count, at:)
    count.times do
      status = Fabricate(:status, account: tomas, media_attachments: [Fabricate(:media_attachment, account: tomas)])
      AlbumPhoto.create!(album: album, contributor: tomas, status: status, created_at: at)
    end
  end

  context 'when the viewer is a member' do
    before do
      krew.krew_memberships.create!(account: user.account, role: 'seeder', source: 'direct', joined_at: 3.days.ago)
      krew.krew_memberships.create!(account: tomas, role: 'member', source: 'direct', joined_at: 2.days.ago)
    end

    it 'lists the newest things done in the Krew, photos grouped by person and album' do
      album = Album.create!(owner: tomas, krew: krew, title: 'Mayhem 2026', visibility: :self_only, contribution: :invited)
      album.album_krews.create!(krew: krew, for_contribution: true)
      add_photos(album, 3, at: 1.hour.ago)

      get "/api/v1/krews/#{krew.slug}/activity", headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body[:lines].pluck(:kind)).to eq %w(photos joined joined)
      expect(response.parsed_body[:lines].first).to include(count: 3, album: include(title: 'Mayhem 2026'), account: include(username: 'tomas'))
    end

    it 'gives a post its own line, but not the posts behind album photos' do
      album = Album.create!(owner: tomas, krew: krew, title: 'Mayhem 2026', visibility: :self_only, contribution: :invited)
      album.album_krews.create!(krew: krew, for_contribution: true)
      add_photos(album, 1, at: 2.hours.ago)
      krew.statuses << AlbumPhoto.last.status
      post = Fabricate(:status, account: tomas, text: 'Seeds are in')
      krew.statuses << post

      get "/api/v1/krews/#{krew.slug}/activity", headers: headers

      expect(response.parsed_body[:lines].pluck(:kind)).to eq %w(post photos joined)
      expect(response.parsed_body[:lines].first[:status_id]).to eq post.id.to_s
    end

    it 'counts what is unread in the Krew chat, as Nudges does' do
      conversation = Nudges::Conversation.krew_for!(krew)
      2.times { |i| conversation.messages.create!(author_account: tomas, body: "hi #{i}") }

      get "/api/v1/krews/#{krew.slug}/activity", headers: headers

      unread = conversation.unread_count_for(user.account)
      expect(unread).to be >= 2
      expect(response.parsed_body[:chat]).to include(conversation_id: conversation.id.to_s, unread: unread)
    end
  end

  context 'when the viewer is not a member' do
    it 'is forbidden' do
      get "/api/v1/krews/#{krew.slug}/activity", headers: headers

      expect(response).to have_http_status(403)
    end
  end
end
