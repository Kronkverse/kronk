# frozen_string_literal: true

require 'rails_helper'

# An event made with "spawn an album" gets an album with the event's reach,
# so an invite-only event's title and description don't go public.
RSpec.describe 'The album an event spawns' do
  let(:author)  { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: author.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def spawned_album(**params)
    post '/api/v1/events', headers: headers,
                           params: { title: 'Secret party', start_time: 2.days.from_now.iso8601, spawn_album: true, **params }
    expect(response).to have_http_status(200)
    KornerAttachment.from_source('kalendar', response.parsed_body['id'].to_i)
                    .find_by(target_slug: 'albutts', kind: 'spawn')
                    .target_record
  end

  it 'is Just me for an invite-only event' do
    expect(spawned_album(invite_only: true).visibility).to eq 'self_only'
  end

  it 'follows the reach chosen for the event' do
    expect(spawned_album(visibility: 'mates').visibility).to eq 'mates'
  end
end
