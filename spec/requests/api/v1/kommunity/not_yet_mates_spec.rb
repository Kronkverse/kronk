# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Kommunity not yet Mates' do
  let(:user)    { Fabricate(:user) }
  let(:viewer)  { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:follows') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  it 'requires a signed-in user' do
    get '/api/v1/kommunity/not_yet_mates'

    expect(response).to have_http_status(401)
  end

  it 'lists who the viewer asked, and who added them one way, but not Mates or incoming requests' do
    mate     = Fabricate(:account, username: 'mate')
    asked    = Fabricate(:account, username: 'asked', locked: true)
    added    = Fabricate(:account, username: 'added')
    follower = Fabricate(:account, username: 'follower')
    asking   = Fabricate(:account, username: 'asking')
    viewer.follow!(mate)
    mate.follow!(viewer)
    Fabricate(:follow_request, account: viewer, target_account: asked)
    Fabricate(:follow, account: viewer, target_account: added)
    Fabricate(:follow, account: follower, target_account: viewer)
    Fabricate(:follow_request, account: asking, target_account: viewer)

    get '/api/v1/kommunity/not_yet_mates', headers: headers

    expect(response).to have_http_status(200)
    expect(response.parsed_body[:sent].pluck(:username)).to eq %w(added asked)
    expect(response.parsed_body[:received].pluck(:username)).to eq %w(follower)
  end
end
