# frozen_string_literal: true

require 'rails_helper'

# GET /api/v1/map/events: an event's pin shows only to people who may see
# the event itself (Event#visible_to?), not just to everyone when the
# event isn't invite-only.
RSpec.describe 'Map event pins' do
  let(:author)   { Fabricate(:user) }
  let(:stranger) { Fabricate(:user) }
  let(:location) { 'https://www.openstreetmap.org/?mlat=-37.81&mlon=144.96' }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def create_event(title, visibility)
    post '/api/v1/events', headers: headers_for(author),
                           params: { title: title, start_time: 2.days.from_now.iso8601, location_url: location, visibility: visibility }
    expect(response).to have_http_status(200)
  end

  def pin_titles_for(user)
    get '/api/v1/map/events', headers: headers_for(user)
    expect(response).to have_http_status(200)
    response.parsed_body.pluck(:title)
  end

  before do
    create_event('Open picnic', 'public')
    create_event('Just me', 'self_only')
  end

  it 'shows a stranger only the event they may see' do
    expect(pin_titles_for(stranger)).to contain_exactly('Open picnic')
  end

  it 'shows the author both' do
    expect(pin_titles_for(author)).to contain_exactly('Open picnic', 'Just me')
  end
end
