# frozen_string_literal: true

require 'rails_helper'

# GET /api/v1/map/events: the Map shows only your events: the ones you
# host and the ones you're going to or interested in (Kommons "Events on
# Map", 2026-10-27), and never one you may not see (Event#visible_to?).
# `?event=<slug>` adds that one event, if you may see it, for the event
# page's location link.
RSpec.describe 'Map event pins' do
  let(:author)   { Fabricate(:user) }
  let(:stranger) { Fabricate(:user) }
  let(:location) { 'https://www.openstreetmap.org/?mlat=-37.81&mlon=144.96' }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def create_event(title, visibility, start: 2.days.from_now)
    post '/api/v1/events', headers: headers_for(author),
                           params: { title: title, start_time: start.iso8601, location_url: location, visibility: visibility }
    expect(response).to have_http_status(200)
    Event.find(response.parsed_body['id'])
  end

  def pin_titles_for(user, params = {})
    get '/api/v1/map/events', headers: headers_for(user), params: params
    expect(response).to have_http_status(200)
    response.parsed_body.pluck(:title)
  end

  def answer(user, title, status)
    EventRsvp.create!(event: Event.find_by!(title: title), account: user.account, status: status)
  end

  before do
    create_event('Open picnic', 'public')
    create_event('Just me', 'self_only')
  end

  it 'shows the host every event they host' do
    expect(pin_titles_for(author)).to contain_exactly('Open picnic', 'Just me')
  end

  it "doesn't show an event you only may see" do
    expect(pin_titles_for(stranger)).to be_empty
  end

  it "shows an event you're going to" do
    answer(stranger, 'Open picnic', :going)

    expect(pin_titles_for(stranger)).to contain_exactly('Open picnic')
  end

  it "shows an event you're interested in" do
    answer(stranger, 'Open picnic', :interested)

    expect(pin_titles_for(stranger)).to contain_exactly('Open picnic')
  end

  it "doesn't show an event you're not going to" do
    answer(stranger, 'Open picnic', :not_going)

    expect(pin_titles_for(stranger)).to be_empty
  end

  it "doesn't show an event you answered but may no longer see" do
    answer(stranger, 'Just me', :going)

    expect(pin_titles_for(stranger)).to be_empty
  end

  it 'adds the event the Map was opened for, when you may see it' do
    picnic = Event.find_by!(title: 'Open picnic')

    expect(pin_titles_for(stranger, event: picnic.slug)).to contain_exactly('Open picnic')
  end

  it "doesn't add the event the Map was opened for when you may not see it" do
    hidden = Event.find_by!(title: 'Just me')

    expect(pin_titles_for(stranger, event: hidden.slug)).to be_empty
    expect(pin_titles_for(stranger, event: 'no-such-event')).to be_empty
  end

  it "doesn't let hidden events use up the pin limit" do
    stub_const('Api::V1::Map::EventsController::MAX_PINS', 1)
    create_event('Earlier, just me', 'self_only', start: 1.hour.from_now)
    answer(stranger, 'Earlier, just me', :going)
    answer(stranger, 'Open picnic', :going)

    expect(pin_titles_for(stranger)).to eq(['Open picnic'])
  end

  it 'counts who is going on each pin' do
    answer(stranger, 'Open picnic', :going)

    get '/api/v1/map/events', headers: headers_for(author)
    counts = response.parsed_body.to_h { |pin| [pin['title'], pin['going_count']] }
    expect(counts).to eq('Open picnic' => 1, 'Just me' => 0)
  end
end
