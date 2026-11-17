# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md, Open to collab: saying so in the Booth invites a
# first message from anyone, Mates or not, never across a block.
RSpec.describe 'Booth open to collab' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:artist)  { Fabricate(:user) }

  def open_to_collab!
    UserKornerSetting.create!(user: artist, korner_slug: 'booth', values: { 'open_to_collab' => true })
  end

  def open_chat
    post '/api/v1/nudges/conversations', headers: headers, params: { account_id: artist.account_id }
  end

  it 'keeps a stranger out until the artist is open to collab, then lets them write', :aggregate_failures do
    open_chat
    expect(response).to have_http_status(403)

    open_to_collab!
    open_chat
    expect(response).to have_http_status(200)

    post "/api/v1/nudges/conversations/#{response.parsed_body['id']}/messages", headers: headers, params: { body: 'Want to make a track?' }
    expect(response).to have_http_status(201)
  end

  it 'still refuses someone the artist has blocked' do
    open_to_collab!
    artist.account.block!(user.account)

    open_chat

    expect(response).to have_http_status(403)
  end

  it 'is the artist\'s own Booth setting' do
    artist_token = Fabricate(:accessible_access_token, resource_owner_id: artist.id, scopes: 'read write')

    patch '/api/v1/korners/booth/settings/open_to_collab', headers: { 'Authorization' => "Bearer #{artist_token.token}" }, params: { value: true }

    expect(BoothCollab.open?(artist.account)).to be true
  end
end
