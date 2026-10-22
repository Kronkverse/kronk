# frozen_string_literal: true

require 'rails_helper'

# An emergence and its Krew are one group, so an event linked to either is
# linked to both, and unlinking from either takes it off both
# (Kronk::EventLinks, decisions.md 2026-10-22).
RSpec.describe 'Event links to an emergence and its Krew' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let(:project) { Freethedream::Project.create!(owner: user.account, title: 'Community Garden') }
  let!(:krew)   { project.ensure_krew! }
  let(:status)  { Fabricate(:status, account: user.account, visibility: :public) }
  let(:event)   { Event.create!(account: user.account, title: 'Garden build day', status: status, start_time: 2.days.from_now) }

  before { Kronk::KornerRegistry.reload! }

  def attach(target_slug, target)
    post '/api/v1/attachments', headers: headers, params: {
      source_slug: 'kalendar', source_id: event.id, target_slug: target_slug, target_id: target.id, kind: 'link'
    }
  end

  def krew_event_ids
    get '/api/v1/events', headers: headers, params: { krew_id: krew.id }
    response.parsed_body.pluck('id')
  end

  it 'puts an event attached to the emergence on its Krew too' do
    attach('freethedream', project)

    expect(response).to have_http_status(200)
    expect(project.reload.event_link&.first).to eq(event)
    expect(krew_event_ids).to include(event.id.to_s)
    expect(krew.krew_korners.pluck(:korner)).to include('kalendar')
  end

  it 'puts an event linked from the Krew on its emergence too' do
    post "/api/v1/events/#{event.id}/krews", headers: headers, params: { krew_id: krew.id }

    expect(response).to have_http_status(200)
    expect(project.reload.event_link&.first).to eq(event)
    expect(krew_event_ids).to include(event.id.to_s)
  end

  it 'takes an event unlinked on the emergence off the Krew too' do
    attach('freethedream', project)
    delete "/api/v1/attachments/#{response.parsed_body['id']}", headers: headers

    expect(project.reload.event_link).to be_nil
    expect(krew_event_ids).to_not include(event.id.to_s)
  end

  it 'takes an event unlinked on the Krew off the emergence too' do
    attach('freethedream', project)
    delete "/api/v1/events/#{event.id}/krews/#{krew.id}", headers: headers

    expect(project.reload.event_link).to be_nil
    expect(krew_event_ids).to_not include(event.id.to_s)
  end

  it 'shows a gang its own event, and the emergence Krew gets it' do
    gang = Freethedream::Project.create!(owner: user.account, title: 'Raised beds', parent: project, root: project)
    attach('freethedream', gang)

    expect(gang.reload.event_link&.first).to eq(event)
    expect(krew_event_ids).to include(event.id.to_s)
  end

  it "leaves the Krew alone when someone else's event is linked" do
    stranger = Fabricate(:user)
    their_event = Event.create!(account: stranger.account, title: 'Not ours', status: Fabricate(:status, account: stranger.account, visibility: :public), start_time: 2.days.from_now)
    attachment = KornerAttachment.create!(source_slug: 'kalendar', source_id: their_event.id, target_slug: 'freethedream', target_id: project.id, kind: 'link', created_by_account: stranger.account)

    Kronk::EventLinks.linked(attachment, stranger.account)

    expect(krew_event_ids).to_not include(their_event.id.to_s)
  end
end
