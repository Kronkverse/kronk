# frozen_string_literal: true

require 'rails_helper'

# A project's Overview: its cover, the Kalendar event it happens at, and
# inviting people to have a look (docs/spaces/freethedream.md).
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
