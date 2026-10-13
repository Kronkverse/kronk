# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/hub.md, Share and Invite.
RSpec.describe 'Space invites' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:mate)    { Fabricate(:user).account }

  before do
    user.account.follow!(mate)
    mate.follow!(user.account)
  end

  def invites_for(account)
    Nudges::Event.where(recipient_account_id: account.id, verb: 'invited')
  end

  it 'tells a Mate, with a way to open the page, once a day per page' do
    2.times { post '/api/v1/space_invites', headers: headers, params: { account_id: mate.id, path: '/hub/albutts/albums/12' } }

    expect(response).to have_http_status(200)
    expect(invites_for(mate).count).to eq 1
    expect(invites_for(mate).first).to have_attributes(source_korner_slug: 'albutts', cta_route: '/hub/albutts/albums/12', cta_label: 'Open Albutts')

    post '/api/v1/space_invites', headers: headers, params: { account_id: mate.id, path: '/hub/albutts' }
    expect(invites_for(mate).count).to eq 2
  end

  it 'is for Mates' do
    stranger = Fabricate(:account)

    post '/api/v1/space_invites', headers: headers, params: { account_id: stranger.id, path: '/hub/albutts' }

    expect(response).to have_http_status(403)
    expect(invites_for(stranger)).to be_empty
  end

  it 'only invites to a page of a space' do
    ['/home', 'https://evil.example/hub/albutts', '/hub/not-a-space', '/hub/albutts?next=//evil.example'].each do |path|
      post '/api/v1/space_invites', headers: headers, params: { account_id: mate.id, path: path }

      expect(response).to have_http_status(422)
    end
    expect(invites_for(mate)).to be_empty
  end
end
