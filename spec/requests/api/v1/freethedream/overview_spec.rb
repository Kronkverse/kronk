# frozen_string_literal: true

require 'rails_helper'

# A project's Overview: its cover, the Kalendar event it happens at, who's
# in it and what each is on, and inviting people to have a look (docs/spaces/freethedream.md).
RSpec.describe 'API V1 FreeTheDream overview' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }
  let(:cara)  { Fabricate(:user) }
  let!(:doof) { api(alice, :post, '/freethedream/projects', project: { title: 'Mini Doof' }) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def api(user, verb, path, params = {})
    public_send(verb, "/api/v1#{path}", params: params, headers: headers_for(user), as: :json)
    response.parsed_body
  end

  def event_by(user, title)
    Event.create!(account: user.account, title: title, start_time: 10.days.from_now, end_time: 11.days.from_now,
                  location_name: 'Back paddock', location_url: 'https://www.openstreetmap.org/?mlat=-28.5&mlon=153.5#map=15/-28.5/153.5')
  end

  def link(user, event)
    api(user, :post, '/attachments', source_slug: 'kalendar', source_id: event.id, target_slug: 'freethedream', target_id: doof['id'].to_i, kind: 'link')
  end

  describe 'the event' do
    it 'shows the Kalendar event the owner linked', :aggregate_failures do
      event = event_by(alice, 'Mini Doof weekend')
      expect(link(alice, event)).to include('target_slug' => 'freethedream')

      body = api(alice, :get, "/freethedream/projects/#{doof['id']}")
      expect(body['event']).to include('id' => event.id.to_s, 'title' => 'Mini Doof weekend', 'location_name' => 'Back paddock', 'can_unlink' => true)
      expect(body['can']).to include('link_event' => true, 'invite' => true)
    end

    it 'ignores an event linked by someone outside the project' do
      link(cara, event_by(cara, 'Not ours'))
      expect(api(alice, :get, "/freethedream/projects/#{doof['id']}")['event']).to be_nil
    end
  end

  describe 'the cover' do
    it 'takes an image the owner uploaded' do
      media = Fabricate(:media_attachment, account: alice.account)
      body = api(alice, :put, "/freethedream/projects/#{doof['id']}", project: { cover_media_attachment_id: media.id })
      expect(body['cover']).to include('id' => media.id.to_s)
    end

    it "refuses someone else's upload" do
      media = Fabricate(:media_attachment, account: bob.account)
      api(alice, :put, "/freethedream/projects/#{doof['id']}", project: { cover_media_attachment_id: media.id })
      expect(response).to have_http_status(403)
    end
  end

  describe "who's in it" do
    before do
      api(bob, :post, "/freethedream/projects/#{doof['id']}/join")
      api(cara, :post, "/freethedream/projects/#{doof['id']}/join")
      kitchen = api(bob, :post, '/freethedream/projects', project: { title: 'Kitchen', parent_id: doof['id'] })
      fire = api(bob, :post, '/freethedream/items', item: { project_id: kitchen['id'], kind: 'job', title: 'build the fire', quantity: 2 })
      api(cara, :post, "/freethedream/items/#{fire['id']}/claim")
    end

    it 'says what each person is on, whoever did something last first', :aggregate_failures do
      body = api(cara, :get, "/freethedream/projects/#{doof['id']}")
      people = body['people'].map { |row| [row['account']['id'], row['organiser'], row['jobs']] }
      expect(people).to eq [
        [cara.account.id.to_s, false, 1],
        [bob.account.id.to_s, false, 1],
        [alice.account.id.to_s, true, 0],
      ]
      expect(body['people'].pluck('last_active')).to all(be_present)
      expect(body['sections'].first).to include('title' => 'Kitchen', 'people_count' => 2)
    end

    it 'counts saying something as being active' do
      api(alice, :post, '/freethedream/comments', subject_type: 'project', subject_id: doof['id'], body: 'Who has a trailer?')
      body = api(cara, :get, "/freethedream/projects/#{doof['id']}")
      expect(body['people'].first['account']['id']).to eq alice.account.id.to_s
    end
  end

  describe 'the activity' do
    it 'lists the latest updates on their own, newest first' do
      api(bob, :post, "/freethedream/projects/#{doof['id']}/join")
      api(bob, :post, '/freethedream/projects', project: { title: 'Ceremony', parent_id: doof['id'] })
      body = api(bob, :get, "/freethedream/projects/#{doof['id']}/activity")
      expect(body.first).to include('verb' => 'section_added', 'data' => include('title' => 'Ceremony'))
    end
  end

  describe 'the dashboard' do
    let(:kitchen) { api(bob, :post, '/freethedream/projects', project: { title: 'Kitchen', parent_id: doof['id'] }) }
    let(:sound) { api(alice, :post, '/freethedream/projects', project: { title: 'Sound', parent_id: doof['id'] }) }

    # Join first: only someone in the emergence can coalesce a gang.
    before do
      api(bob, :post, "/freethedream/projects/#{doof['id']}/join")
      api(cara, :post, "/freethedream/projects/#{doof['id']}/join")
      kitchen
      sound
    end

    def mine(user)
      api(user, :get, "/freethedream/projects/#{doof['id']}")['mine']
    end

    it "gathers the viewer's groups, jobs, and what they're bringing", :aggregate_failures do
      plates = api(bob, :post, '/freethedream/items', item: { project_id: kitchen['id'], kind: 'need', title: 'plates', quantity: 30 })
      fire = api(bob, :post, '/freethedream/items', item: { project_id: kitchen['id'], kind: 'job', title: 'build the fire', quantity: 2 })
      api(alice, :post, '/freethedream/items', item: { project_id: sound['id'], kind: 'need', title: 'speakers', quantity: 2 })
      api(cara, :post, "/freethedream/items/#{fire['id']}/claim")
      api(cara, :post, "/freethedream/items/#{plates['id']}/bring", quantity: 10)

      body = mine(cara)
      expect(body['groups'].pluck('title')).to eq ['Kitchen']
      expect(body['jobs'].pluck('title')).to eq ['build the fire']
      expect(body['bringing']).to eq [{ 'id' => plates['id'], 'title' => 'plates', 'quantity' => 10, 'unit' => '' }]
      expect(body['needed'].pluck('title')).to eq ['plates']
      expect(body['needed_count']).to eq 1
    end

    it 'counts talk from others until you look', :aggregate_failures do
      api(bob, :post, '/freethedream/comments', subject_type: 'project', subject_id: kitchen['id'], body: 'Who has a big pot?')

      expect(mine(cara)['unseen']).to eq [{ 'id' => kitchen['id'], 'title' => 'Kitchen', 'count' => 1 }]
      expect(mine(bob)['unseen']).to eq []
      expect(mine(bob)['groups'].first).to include('title' => 'Kitchen', 'unseen' => 0)

      api(cara, :post, "/freethedream/projects/#{kitchen['id']}/seen")
      expect(mine(cara)['unseen']).to eq []
    end

    it 'is not there for someone outside the project' do
      expect(mine(Fabricate(:user))).to be_nil
    end
  end

  describe 'inviting' do
    before { api(bob, :post, "/freethedream/projects/#{doof['id']}/join") }

    # Nudges turns this event into the notification (nudges.yaml); the
    # listen entry itself is pinned in spec/lib/nudges/directed_listens_spec.rb.
    it 'publishes an invite for each person, but not for members', :aggregate_failures do
      received = []
      Kronk::KornerEvents.subscribe('freethedream.project.invited') { |payload| received << payload }

      body = api(bob, :post, "/freethedream/projects/#{doof['id']}/invite", account_ids: [cara.account.id, alice.account.id])
      expect(body).to eq('invited' => 1)
      expect(received).to contain_exactly(
        { actor_account_id: bob.account.id, recipient_account_id: cara.account.id, project_id: doof['id'].to_i }
      )
    end

    it 'is for members only' do
      api(cara, :post, "/freethedream/projects/#{doof['id']}/invite", account_ids: [bob.account.id])
      expect(response).to have_http_status(403)
    end
  end
end
