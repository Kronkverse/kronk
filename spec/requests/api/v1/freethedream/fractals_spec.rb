# frozen_string_literal: true

require 'rails_helper'

# Kommons "Fractals" (2026-11-22): a Komponent's fractals are checklists on
# its own page, each assigned to people in the projekt
# (docs/spaces/freethedream.md, Fractals on a Komponent's page).
RSpec.describe 'API V1 FreeTheDream fractals' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }
  let(:cara)  { Fabricate(:user) }
  let!(:doof) do
    api(alice, :post, '/projects', project: { title: 'Mini Doof', krew_id: Fabricate(:krew, seeded_by: alice.account).id })
  end
  let!(:kitchen) { api(alice, :post, '/projects', project: { title: 'Kitchen', parent_id: doof['id'] }) }
  let!(:cooking) { api(alice, :post, '/projects', project: { title: 'Cooking', parent_id: kitchen['id'] }) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def api(user, verb, path, params = {})
    public_send(verb, "/api/v1/freethedream#{path}", params: params, headers: headers_for(user), as: :json)
    response.parsed_body
  end

  before { api(bob, :post, "/projects/#{doof['id']}/join") }

  it "shows each fractal's checklist on its Komponent's page", :aggregate_failures do
    api(bob, :post, '/items', item: { project_id: cooking['id'], kind: 'job', title: 'Spice run' })
    api(bob, :post, '/items', item: { project_id: kitchen['id'], kind: 'job', title: 'Book the hall' })

    page = api(bob, :get, "/projects/#{kitchen['id']}")
    expect(page['items'].pluck('title')).to eq ['Book the hall']
    expect(page['fractals'].sole).to include('title' => 'Cooking', 'assignees' => [], 'can' => { 'remove' => false })
    expect(page['fractals'].sole['items'].pluck('title')).to eq ['Spice run']
    expect(page['members'].pluck('id')).to contain_exactly(alice.account.id.to_s, bob.account.id.to_s)
    expect(api(bob, :get, "/projects/#{doof['id']}")['fractals']).to eq []
  end

  it 'is assigned by anyone in the projekt, to people in it', :aggregate_failures do
    api(bob, :post, "/projects/#{cooking['id']}/assign", account_id: alice.account.id)
    expect(response).to have_http_status(200)
    api(bob, :post, "/projects/#{cooking['id']}/assign", account_id: bob.account.id)
    expect(api(alice, :get, "/projects/#{kitchen['id']}")['fractals'].sole['assignees'].pluck('id'))
      .to eq [alice.account.id.to_s, bob.account.id.to_s]

    api(alice, :post, "/projects/#{cooking['id']}/unassign", account_id: bob.account.id)
    expect(api(alice, :get, "/projects/#{kitchen['id']}")['fractals'].sole['assignees'].pluck('id')).to eq [alice.account.id.to_s]

    api(bob, :post, "/projects/#{cooking['id']}/assign", account_id: cara.account.id)
    expect(response).to have_http_status(422)
    api(cara, :post, "/projects/#{cooking['id']}/assign", account_id: cara.account.id)
    expect(response).to have_http_status(403)
    api(bob, :post, "/projects/#{kitchen['id']}/assign", account_id: bob.account.id)
    expect(response).to have_http_status(403)
  end

  it 'goes when the fractal is removed' do
    api(alice, :post, "/projects/#{cooking['id']}/assign", account_id: alice.account.id)
    api(alice, :delete, "/projects/#{cooking['id']}")
    expect(Freethedream::Assignment.count).to eq 0
  end
end
