# frozen_string_literal: true

require 'rails_helper'

# Krews and albums, before 2.1.0: the Krew page doesn't rebuild its chat's
# memberships on every view; an album edit keeps links the form can't show;
# giving an album away clears its asks; an archived Krew takes no links.
RSpec.describe 'Krew and album clean-up' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def krew_for(slug, *accounts)
    Krew.create!(slug: slug, name: slug.capitalize, access: 'open', seeded_by: accounts.first, last_activity_at: Time.current).tap do |krew|
      accounts.each { |account| krew.krew_memberships.create!(account: account, role: 'member', source: 'direct') }
    end
  end

  it "reads the Krew page's chat without rebuilding it each time" do
    krew = krew_for('growers', me)
    get "/api/v1/krews/#{krew.slug}/activity", headers: headers
    conversation_id = response.parsed_body.dig('chat', 'conversation_id')

    allow(Nudges::Conversation).to receive(:krew_for!).and_call_original
    get "/api/v1/krews/#{krew.slug}/activity", headers: headers

    expect(response.parsed_body.dig('chat', 'conversation_id')).to eq conversation_id
    expect(Nudges::Conversation).to_not have_received(:krew_for!)
  end

  it "keeps an album's link to a Krew its owner has left when the album is edited" do
    left = krew_for('oldcrew', Fabricate(:account))
    mine = krew_for('newcrew', me)
    album = Album.create!(owner: me, title: 'Road trip', visibility: :public)
    album.album_krews.create!(krew: left)
    album.album_krews.create!(krew: mine)

    patch "/api/v1/albutts/albums/#{album.id}", headers: headers, params: { album: { title: 'Road trip 2026' }, krew_ids: [mine.id] }

    expect(response).to have_http_status(200)
    expect(album.reload.album_krews.pluck(:krew_id)).to contain_exactly(left.id, mine.id)
  end

  it 'clears the asks to add photos when an album is given to a Krew' do
    krew = krew_for('growers', me)
    album = Album.create!(owner: me, title: 'Road trip', visibility: :public)
    AlbumContributionRequest.create!(album: album, account: Fabricate(:account))

    post "/api/v1/albutts/albums/#{album.id}/give", headers: headers, params: { krew_id: krew.id }

    expect(response).to have_http_status(200)
    expect(album.reload.contribution_requests).to be_empty
  end

  it 'refuses to link an album to an archived Krew' do
    krew = krew_for('growers', me)
    krew.update!(archived_at: Time.current)
    album = Album.create!(owner: me, title: 'Road trip', visibility: :public)

    post "/api/v1/albutts/albums/#{album.id}/krews", headers: headers, params: { krew_id: krew.id }

    expect(response).to have_http_status(422)
    expect(album.album_krews).to be_empty
  end
end
