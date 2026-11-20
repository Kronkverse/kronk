# frozen_string_literal: true

require 'rails_helper'

# An event's schedule (docs/spaces/kalendar.md, Schedule): one set of lines
# per event. Its host keeps it; Konnected to a projekt, anyone in the
# projekt does too. Whoever can see the event can read it.
RSpec.describe 'API V1 event schedule' do
  let(:host)     { Fabricate(:user) }
  let(:member)   { Fabricate(:user) }
  let(:stranger) { Fabricate(:user) }
  let(:event) do
    Event.create!(account: host.account, title: 'Mini Doof', start_time: 3.days.from_now, end_time: 4.days.from_now)
  end

  def api(user, verb, path, params = {})
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses')
    public_send(verb, "/api/v1/events/#{event.id}#{path}", params: params, headers: { 'Authorization' => "Bearer #{token.token}" }, as: :json)
    response.parsed_body
  end

  def line(**attrs)
    { day: '2026-12-05', start: '10:00', title: 'Doors' }.merge(attrs)
  end

  def konnect_to_projekt!
    projekt = Freethedream::Project.create!(title: 'Doof crew', owner: host.account)
    projekt.add_member!(member.account)
    komponent = Freethedream::Project.create!(title: 'Kitchen', owner: host.account, parent: projekt, root: projekt)
    KornerAttachment.create!(source_slug: 'kalendar', source_id: event.id, target_slug: 'freethedream', target_id: komponent.id,
                             kind: 'link', created_by_account: host.account)
    projekt
  end

  before do
    # Seen by everyone, so reading is down to the event and editing to the rule.
    allow_any_instance_of(Event).to receive(:visible_to?).and_return(true) # rubocop:disable RSpec/AnyInstance
  end

  it 'lets the host add, change and remove lines, kept in day and time order', :aggregate_failures do
    api(host, :post, '/schedule/lines', line(day: '2026-12-06', start: '09:00', title: 'Breakfast'))
    body = api(host, :post, '/schedule/lines', line(start: '18:30', end: '20:00', title: 'Dinner', note: 'Long table'))
    expect(response).to have_http_status(200)
    expect(body['can_edit']).to be true
    expect(body['lines'].map { |l| [l['day'], l['start'], l['end'], l['title']] })
      .to eq [['2026-12-05', '18:30', '20:00', 'Dinner'], ['2026-12-06', '09:00', nil, 'Breakfast']]

    dinner = body['lines'].first['id']
    body = api(host, :patch, "/schedule/lines/#{dinner}", start: '19:00', end: '', title: 'Late dinner')
    expect(body['lines'].first).to include('start' => '19:00', 'end' => nil, 'title' => 'Late dinner', 'note' => 'Long table')

    body = api(host, :delete, "/schedule/lines/#{dinner}")
    expect(body['lines'].pluck('title')).to eq ['Breakfast']
  end

  it 'refuses a line that makes no sense', :aggregate_failures do
    api(host, :post, '/schedule/lines', line(title: ''))
    expect(response).to have_http_status(422)

    api(host, :post, '/schedule/lines', line(start: '10:00', end: '09:00'))
    expect(response).to have_http_status(422)

    api(host, :post, '/schedule/lines', line(start: 'soon'))
    expect(response).to have_http_status(422)
    expect(event.schedule_lines).to be_empty
  end

  it 'lets a standalone event be read by anyone who sees it, and edited only by its host', :aggregate_failures do
    event.schedule_lines.create!(day: Date.new(2026, 12, 5), start_minute: 600, title: 'Doors')

    body = api(stranger, :get, '/schedule')
    expect(response).to have_http_status(200)
    expect(body).to include('can_edit' => false, 'projekt' => nil)
    expect(body['lines'].pluck('title')).to eq ['Doors']

    api(stranger, :post, '/schedule/lines', line)
    expect(response).to have_http_status(403)
    api(member, :post, '/schedule/lines', line)
    expect(response).to have_http_status(403)
    expect(event.schedule_lines.count).to eq 1
  end

  it 'lets anyone in a Konnected projekt edit it, and nobody outside it', :aggregate_failures do
    projekt = konnect_to_projekt!

    body = api(member, :post, '/schedule/lines', line(title: 'Set up the kitchen'))
    expect(response).to have_http_status(200)
    expect(body).to include('can_edit' => true, 'projekt' => include('id' => projekt.id.to_s, 'title' => 'Doof crew'))
    expect(event.schedule_lines.pluck(:title)).to eq ['Set up the kitchen']

    expect(api(stranger, :get, '/schedule')['can_edit']).to be false
    api(stranger, :post, '/schedule/lines', line)
    expect(response).to have_http_status(403)
  end

  it "doesn't hand the schedule to a projekt its host isn't in" do
    projekt = Freethedream::Project.create!(title: 'Elsewhere', owner: stranger.account)
    KornerAttachment.create!(source_slug: 'kalendar', source_id: event.id, target_slug: 'freethedream', target_id: projekt.id,
                             kind: 'link', created_by_account: host.account)

    api(stranger, :post, '/schedule/lines', line)
    expect(response).to have_http_status(403)
  end

  it "answers 404 for an event the viewer can't see" do
    allow_any_instance_of(Event).to receive(:visible_to?).and_return(false) # rubocop:disable RSpec/AnyInstance

    api(stranger, :get, '/schedule')
    expect(response).to have_http_status(404)
  end
end
