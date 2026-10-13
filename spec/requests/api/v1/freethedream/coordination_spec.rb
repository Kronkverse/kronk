# frozen_string_literal: true

require 'rails_helper'

# FreeTheDream for an in-person event: a kitchen with sections, gear people
# bring, what's still needed across it all, updates, and threads that can
# be resolved (docs/spaces/freethedream.md).
RSpec.describe 'API V1 FreeTheDream coordination' do
  let(:alice) { Fabricate(:user) }
  let!(:doof) do
    api(alice, :post, '/projects', project: { title: 'Mini Doof', ends_on: '2026-12-06' })
  end
  let!(:kitchen) { api(alice, :post, '/projects', project: { title: 'Kitchen', parent_id: doof['id'] }) }
  let!(:wash) { api(alice, :post, '/projects', project: { title: 'Wash station', parent_id: kitchen['id'] }) }
  let(:bob)   { Fabricate(:user) }
  let(:cara)  { Fabricate(:user) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def api(user, verb, path, params = {})
    public_send(verb, "/api/v1/freethedream#{path}", params: params, headers: headers_for(user), as: :json)
    response.parsed_body
  end

  before do
    api(bob, :post, "/projects/#{doof['id']}/join")
    api(cara, :post, "/projects/#{doof['id']}/join")
  end

  describe 'bringing' do
    let!(:plates) { api(alice, :post, '/items', item: { project_id: kitchen['id'], kind: 'need', title: 'plates', quantity: 30 }) }

    it 'sets, changes and takes back how much you bring', :aggregate_failures do
      expect(api(bob, :post, "/items/#{plates['id']}/bring", quantity: 12)).to include('covered' => 12, 'left' => 18, 'my_quantity' => 12)
      expect(api(cara, :post, "/items/#{plates['id']}/bring", quantity: 14)['left']).to eq 4
      expect(api(bob, :post, "/items/#{plates['id']}/bring", quantity: 10)).to include('covered' => 24, 'my_quantity' => 10)

      body = api(bob, :post, "/items/#{plates['id']}/bring", quantity: 0)
      expect(body).to include('covered' => 14, 'my_quantity' => 0)
      expect(body['contributors'].pluck('quantity')).to eq [14]
    end

    it 'keeps units with the need' do
      rice = api(alice, :post, '/items', item: { project_id: kitchen['id'], kind: 'need', title: 'rice', quantity: 5, unit: 'kg' })
      expect(api(bob, :post, "/items/#{rice['id']}/bring", quantity: 2)).to include('unit' => 'kg', 'left' => 3)
    end

    it 'refuses people outside the project' do
      api(Fabricate(:user), :post, "/items/#{plates['id']}/bring", quantity: 2)
      expect(response).to have_http_status(403)
    end
  end

  describe 'the project page' do
    it "rolls up what's still needed from every section, saying where", :aggregate_failures do
      api(alice, :post, '/items', item: { project_id: wash['id'], kind: 'need', title: 'tea towels', quantity: 10 })
      api(alice, :post, '/items', item: { project_id: kitchen['id'], kind: 'job', title: 'build the fire frame', quantity: 2 })
      covered = api(alice, :post, '/items', item: { project_id: kitchen['id'], kind: 'need', title: 'tables', quantity: 3 })
      api(bob, :post, "/items/#{covered['id']}/bring", quantity: 3)

      body = api(cara, :get, "/projects/#{doof['id']}")
      expect(body['still_needed'].pluck('title')).to contain_exactly('tea towels', 'build the fire frame')
      expect(body['still_needed'].find { |i| i['title'] == 'tea towels' }['section']['title']).to eq 'Wash station'
      expect(body['progress']).to eq('sorted' => 1, 'total' => 3, 'open_jobs' => 2)

      section = body['sections'].find { |s| s['title'] == 'Kitchen' }
      expect(section['progress']).to include('sorted' => 1, 'total' => 3)
      expect(section['sections_count']).to eq 1
    end

    it 'shows updates from every section inside', :aggregate_failures do
      towels = api(alice, :post, '/items', item: { project_id: wash['id'], kind: 'need', title: 'tea towels', quantity: 10 })
      api(bob, :post, "/items/#{towels['id']}/bring", quantity: 4)

      updates = api(cara, :get, "/projects/#{doof['id']}")['updates']
      expect(updates.first).to include('verb' => 'bringing')
      expect(updates.first['data']).to include('title' => 'tea towels', 'quantity' => 4)
      expect(updates.pluck('verb')).to include('need_added', 'section_added')
    end
  end

  describe 'talk' do
    it 'threads replies and folds resolved threads to the end', :aggregate_failures do
      first = api(bob, :post, '/comments', subject_type: 'project', subject_id: kitchen['id'], body: 'Who has a big pot?').first
      api(cara, :post, '/comments', subject_type: 'project', subject_id: kitchen['id'], body: 'Me, 40 L', parent_id: first['id'])
      api(alice, :post, '/comments', subject_type: 'project', subject_id: kitchen['id'], body: 'Spit roast or frame?')

      threads = api(alice, :post, "/comments/#{first['id']}/resolve")
      expect(threads.pluck('body')).to eq ['Spit roast or frame?', 'Who has a big pot?']
      expect(threads.last).to include('resolved' => true)
      expect(threads.last['resolved_by']['id']).to eq alice.account_id.to_s
      expect(threads.last['replies'].pluck('body')).to eq ['Me, 40 L']

      expect(api(bob, :post, "/comments/#{first['id']}/unresolve").first['resolved']).to be false
    end

    it 'keeps the replies when someone takes back a comment', :aggregate_failures do
      first = api(bob, :post, '/comments', subject_type: 'project', subject_id: kitchen['id'], body: 'Ice?').first
      api(cara, :post, '/comments', subject_type: 'project', subject_id: kitchen['id'], body: 'Six bags', parent_id: first['id'])

      threads = api(bob, :delete, "/comments/#{first['id']}")
      expect(threads.first).to include('removed' => true, 'body' => '')
      expect(threads.first['replies'].pluck('body')).to eq ['Six bags']
    end

    it 'refuses a reply on a different thread subject' do
      other = api(bob, :post, '/comments', subject_type: 'project', subject_id: wash['id'], body: 'Soap?').first
      api(cara, :post, '/comments', subject_type: 'project', subject_id: kitchen['id'], body: 'Yes', parent_id: other['id'])
      expect(response).to have_http_status(422)
    end
  end
end
