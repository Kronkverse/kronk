# frozen_string_literal: true

require 'rails_helper'

# A space's own Kuddle (docs/spaces/huddle.md, A space's own Kuddle; Tal,
# 2026-11-10): one each for a Krew, a projekt and a Komponent, members only.
RSpec.describe 'API V1 Huddle spaces' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }
  let(:krew)  { Fabricate(:krew, seeded_by: alice.account) }
  let(:doof)  { Freethedream::Project.create!(title: 'Mini Doof', owner: alice.account, krew: krew) }
  let(:tents) { Freethedream::Project.create!(title: 'Tents', owner: alice.account, parent: doof) }

  before do
    krew.krew_memberships.find_or_create_by!(account: alice.account) do |m|
      m.role = 'seeder'
      m.source = 'direct'
    end
  end

  def api(user, verb, path, params = {})
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    public_send(verb, "/api/v1#{path}", params: params, headers: { 'Authorization' => "Bearer #{token.token}" }, as: :json)
    response.parsed_body
  end

  it 'makes a Krew its own Kuddle once, for its members', :aggregate_failures do
    first = api(alice, :post, '/huddle/spaces', krew_id: krew.id)
    again = api(alice, :post, '/huddle/spaces', krew_id: krew.id)

    expect(again['id']).to eq first['id']
    expect(first['space']).to include('kind' => 'krew', 'id' => krew.id.to_s, 'name' => krew.name)
    expect(HuddleSession.find(first['id'])).to have_attributes(scope: 'space', krew_id: krew.id)
  end

  it 'keeps it from everyone outside the Krew', :aggregate_failures do
    room = api(alice, :post, '/huddle/spaces', krew_id: krew.id)

    api(bob, :post, '/huddle/spaces', krew_id: krew.id)
    expect(response).to have_http_status(403)

    api(bob, :get, "/huddle/rooms/#{room['id']}")
    expect(response).to have_http_status(404)

    api(bob, :post, '/calls/token', kind: 'kuddle', id: room['id'])
    expect(response).to have_http_status(404)

    expect(api(bob, :get, '/huddle/rooms').pluck('id')).to_not include(room['id'])
    expect(api(alice, :get, '/huddle/rooms').pluck('id')).to_not include(room['id'])
  end

  it 'lets a member in, and follows it for them' do
    room = api(alice, :post, '/huddle/spaces', krew_id: krew.id)
    krew.krew_memberships.create!(account: bob.account, source: 'direct')

    expect(api(bob, :get, "/huddle/rooms/#{room['id']}")).to include('id' => room['id'], 'followed' => true)
    api(bob, :post, '/calls/token', kind: 'kuddle', id: room['id'])
    expect(response).to have_http_status(200)
    expect(Huddle::Follows.follower_ids(HuddleSession.find(room['id']))).to include(bob.account.id)
  end

  it "gives a projekt and a Komponent theirs, its projekt's members' to get into", :aggregate_failures do
    own = api(alice, :post, '/huddle/spaces', project_id: doof.id)
    part = api(alice, :post, '/huddle/spaces', project_id: tents.id)
    expect(part['id']).to_not eq own['id']
    expect(part['space']).to include('kind' => 'freethedream', 'id' => tents.id.to_s, 'top_id' => doof.id.to_s)

    api(bob, :get, "/huddle/rooms/#{part['id']}")
    expect(response).to have_http_status(404)

    Freethedream::Membership.create!(project: doof, account: bob.account, state: :member)
    api(bob, :get, "/huddle/rooms/#{part['id']}")
    expect(response).to have_http_status(200)
  end

  it "lists a Krew's Kuddles, its own first, then its projekts' and Komponents'" do
    tent_room = api(alice, :post, '/huddle/spaces', project_id: tents.id)
    doof_room = api(alice, :post, '/huddle/spaces', project_id: doof.id)
    own = api(alice, :post, '/huddle/spaces', krew_id: krew.id)

    ids = api(alice, :get, '/huddle/spaces', krew_id: krew.id).pluck('id')
    expect(ids.first).to eq own['id']
    expect(ids).to contain_exactly(own['id'], doof_room['id'], tent_room['id'])

    api(bob, :get, '/huddle/spaces', krew_id: krew.id)
    expect(response).to have_http_status(403)
  end

  it "gives the projekt page its Kuddle's id" do
    room = api(alice, :post, '/huddle/spaces', project_id: doof.id)

    expect(api(alice, :get, "/freethedream/projects/#{doof.id}")['kuddle_id']).to eq room['id']
  end
end
