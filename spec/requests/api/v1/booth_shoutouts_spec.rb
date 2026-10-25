# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md, Shoutouts.
RSpec.describe 'API V1 Booth Shoutouts' do
  let(:user)      { Fabricate(:user) }
  let(:token)     { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers)   { { 'Authorization' => "Bearer #{token.token}" } }
  let(:artist)    { Fabricate(:account) }
  let(:booth_set) { Fabricate(:booth_set, account: artist, published: true, duration_seconds: 3600) }
  let(:events)    { [] }

  before do
    allow(Kronk::KornerEvents).to receive(:publish) { |name, **payload| events << [name, payload] }
  end

  def shout(set = booth_set, **params)
    post "/api/v1/booth_sets/#{set.id}/shoutouts", headers: headers, params: params
  end

  it 'posts a shoutout at a moment, lists it newest first, and tells the artist', :aggregate_failures do
    shout(body: 'That drop!', at_seconds: 754)
    expect(response).to have_http_status(200)
    expect(response.parsed_body).to include('body' => 'That drop!', 'at_seconds' => 754, 'can_remove' => true)

    shout(body: 'Lovely all the way through')

    get "/api/v1/booth_sets/#{booth_set.id}/shoutouts", headers: headers
    expect(response.parsed_body.pluck('body')).to eq ['Lovely all the way through', 'That drop!']
    expect(response.parsed_body.last.dig('account', 'username')).to eq user.account.username
    expect(events).to eq [
      ['booth.set.shouted', { actor_account_id: user.account.id, recipient_account_id: artist.id, booth_set_id: booth_set.id }],
      ['booth.set.shouted', { actor_account_id: user.account.id, recipient_account_id: artist.id, booth_set_id: booth_set.id }],
    ]
  end

  it 'does not nudge the artist about their own shoutout' do
    own = Fabricate(:booth_set, account: user.account, published: true)

    shout(own, body: 'Thanks for listening')

    expect(events).to be_empty
  end

  it 'rejects an empty shoutout or a moment past the end', :aggregate_failures do
    shout(body: '   ')
    expect(response).to have_http_status(422)

    shout(body: 'Too far', at_seconds: 4000)
    expect(response).to have_http_status(422)
  end

  it 'hides shoutouts on a set the member cannot see' do
    draft = Fabricate(:booth_set, account: artist, published: false)

    get "/api/v1/booth_sets/#{draft.id}/shoutouts", headers: headers

    expect(response).to have_http_status(404)
  end

  it 'lets the author or the set owner remove a shoutout, and nobody else', :aggregate_failures do
    mine = booth_set.shoutouts.create!(account: user.account, body: 'Mine')
    theirs = booth_set.shoutouts.create!(account: Fabricate(:account), body: 'Theirs')

    delete "/api/v1/booth_shoutouts/#{theirs.id}", headers: headers
    expect(response).to have_http_status(403)

    delete "/api/v1/booth_shoutouts/#{mine.id}", headers: headers
    expect(response).to have_http_status(200)

    owner_token = Fabricate(:accessible_access_token, resource_owner_id: Fabricate(:user, account: artist).id, scopes: 'read:statuses write:statuses')
    delete "/api/v1/booth_shoutouts/#{theirs.id}", headers: { 'Authorization' => "Bearer #{owner_token.token}" }
    expect(response).to have_http_status(200)
    expect(booth_set.shoutouts.reload).to be_empty
  end
end
