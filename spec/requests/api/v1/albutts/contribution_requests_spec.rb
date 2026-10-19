# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/albutts.md, Asking to add photos: someone who can see an album
# but not add to it can ask; the owner lets them in or doesn't.
RSpec.describe 'Asking to add photos to an album' do
  let(:owner)  { Fabricate(:user) }
  let(:asker)  { Fabricate(:user) }
  let(:album)  { Album.create!(owner: owner.account, title: 'Beach day', visibility: :public, contribution: :invited) }
  let(:base)   { "/api/v1/albutts/albums/#{album.id}/contribution_requests" }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  before { allow(Kronk::KornerEvents).to receive(:publish) }

  it 'tells the owner, who sees who is asking and lets them in' do
    post base, headers: headers_for(asker)
    expect(response).to have_http_status(200)
    expect(Kronk::KornerEvents).to have_received(:publish)
      .with('albutts.contribution.requested', hash_including(actor_account_id: asker.account.id, recipient_account_id: owner.account.id, album_id: album.id))

    get "/api/v1/albutts/albums/#{album.id}", headers: headers_for(asker)
    expect(response.parsed_body).to include('contribution_requested' => true, 'can_contribute' => false)
    expect(response.parsed_body).to_not have_key('contribution_requests_count')

    get "/api/v1/albutts/albums/#{album.id}", headers: headers_for(owner)
    expect(response.parsed_body['contribution_requests_count']).to eq(1)

    get base, headers: headers_for(owner)
    request_id = response.parsed_body.first['id']
    expect(response.parsed_body.first['account']['id']).to eq(asker.account.id.to_s)

    post "#{base}/#{request_id}/accept", headers: headers_for(owner)
    expect(response).to have_http_status(200)
    expect(album.reload.contributable_by?(asker.account)).to be(true)
    expect(album.contribution_requests).to be_empty
    expect(Kronk::KornerEvents).to have_received(:publish)
      .with('albutts.contribution.granted', hash_including(recipient_account_id: asker.account.id, album_id: album.id))
  end

  it 'asks once, however many times you tap' do
    2.times { post base, headers: headers_for(asker) }

    expect(album.contribution_requests.count).to eq(1)
    expect(Kronk::KornerEvents).to have_received(:publish).once
  end

  it "doesn't take a request from someone who can already add, or can't see the album" do
    post base, headers: headers_for(owner)
    expect(response).to have_http_status(422)

    album.update!(visibility: :self_only)
    post base, headers: headers_for(asker)
    expect(response).to have_http_status(404)
  end

  it 'keeps the list and the say to the owner, and lets you take yours back' do
    post base, headers: headers_for(asker)
    request_id = response.parsed_body['id']

    get base, headers: headers_for(asker)
    expect(response).to have_http_status(404)
    post "#{base}/#{request_id}/accept", headers: headers_for(asker)
    expect(response).to have_http_status(404)

    delete "#{base}/#{request_id}", headers: headers_for(asker)
    expect(response).to have_http_status(200)
    expect(album.contribution_requests).to be_empty
  end
end
