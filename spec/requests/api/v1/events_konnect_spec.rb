# frozen_string_literal: true

require 'rails_helper'

# docs/decisions.md, 2026-10-23: an event's album or Huddle is Konnected, not
# spawned. The API ignores `spawn_album`, and an edit that leaves out
# `event_type` keeps the event's type (the Android app still sends it).
RSpec.describe 'Event albums and Huddles are Konnected' do
  let(:author)  { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: author.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def create_event(**params)
    post '/api/v1/events', headers: headers, params: { title: 'Party', start_time: 2.days.from_now.iso8601, **params }
    expect(response).to have_http_status(200)
    Event.find(response.parsed_body['id'])
  end

  it 'spawns no album when made with spawn_album' do
    event = nil
    expect { event = create_event(spawn_album: true) }.to_not change(Album, :count)
    expect(KornerAttachment.from_source('kalendar', event.id)).to be_empty
    expect(response.parsed_body).to_not have_key('spawn_album')
  end

  it 'ignores spawn_album on an edit' do
    event = create_event

    put "/api/v1/events/#{event.id}", headers: headers, params: { title: 'Party', spawn_album: true }

    expect(response).to have_http_status(200)
    expect(event.reload.spawn_album).to be false
  end

  it 'keeps a Huddle event a Huddle when an edit leaves out event_type' do
    event = create_event(event_type: 'huddle')

    put "/api/v1/events/#{event.id}", headers: headers, params: { title: 'Renamed' }

    expect(response).to have_http_status(200)
    expect(event.reload).to have_attributes(title: 'Renamed', event_type: 'huddle')
    expect(event.huddle_url).to be_present
  end
end
