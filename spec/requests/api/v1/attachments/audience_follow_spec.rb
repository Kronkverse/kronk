# frozen_string_literal: true

require 'rails_helper'

# "Same as": a record Konnected to another can take its audience and follow
# it (Kronk::Audience, decisions.md 2026-10-25).
RSpec.describe 'Konnections carrying audience' do
  let(:author)   { Fabricate(:user) }
  let(:member)   { Fabricate(:user) }
  let(:stranger) { Fabricate(:user) }
  let(:growers)  { Krew.create!(slug: 'growers', name: 'Growers', access: 'open') }
  let(:weavers)  { Krew.create!(slug: 'weavers', name: 'Weavers', access: 'open') }
  let(:album)    { Album.create!(owner: author.account, title: 'Harvest photos', visibility: :public) }

  before do
    Kronk::KornerRegistry.reload!
    [growers, weavers].each { |krew| krew.krew_memberships.create!(account: author.account) }
    growers.krew_memberships.create!(account: member.account)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def create_event(**params)
    post '/api/v1/events', headers: headers_for(author), params: { title: 'Harvest', start_time: 2.days.from_now.iso8601, **params }
    Event.find(response.parsed_body['id'])
  end

  def growers_event
    create_event(visibility: 'self_only', krew_ids: [growers.id])
  end

  def follow(user, source_slug, source_id, target_slug, target_id)
    post '/api/v1/attachments', headers: headers_for(user), params: {
      source_slug: source_slug, source_id: source_id, target_slug: target_slug, target_id: target_id, kind: 'link', metadata: { audience: 'same' }
    }
    response.parsed_body
  end

  def audience_of(record)
    Kronk::Audience.read(record.reload)
  end

  it "copies a Krew-only event's audience onto an album" do
    event = growers_event
    body = follow(author, 'albutts', album.id, 'kalendar', event.id)

    expect(response).to have_http_status(200)
    expect(body['audience_follows']).to eq('target')
    expect(body['metadata']).to eq('audience_follows' => 'target')
    expect(audience_of(album)).to eq(tier: 'self_only', krew_ids: [growers.id])
    expect(album.visible_to?(member.account)).to be(true)
    expect(album.visible_to?(stranger.account)).to be(false)
  end

  it 'follows the event when it adds a Krew' do
    event = growers_event
    follow(author, 'albutts', album.id, 'kalendar', event.id)
    post '/api/v1/attachments', headers: headers_for(author), params: { source_slug: 'kalendar', source_id: event.id, target_slug: 'krew', target_id: weavers.id, kind: 'link' }

    expect(audience_of(album)).to eq(tier: 'self_only', krew_ids: [growers.id, weavers.id].sort)
  end

  it 'is held to its owner while the event is invite-only, and opens with it' do
    event = growers_event
    follow(author, 'albutts', album.id, 'kalendar', event.id)

    put "/api/v1/events/#{event.id}", headers: headers_for(author), params: { invite_only: true }
    expect(audience_of(album)).to eq(tier: 'self_only', krew_ids: [])

    put "/api/v1/events/#{event.id}", headers: headers_for(author), params: { invite_only: false, visibility: 'public' }
    expect(audience_of(album)[:tier]).to eq('public')
    expect(album.visible_to?(stranger.account)).to be(true)
  end

  it 'keeps the audience it has when it stops following' do
    event = growers_event
    id = follow(author, 'albutts', album.id, 'kalendar', event.id)['id']
    patch "/api/v1/attachments/#{id}", headers: headers_for(author), params: { audience_follows: nil }

    expect(response).to have_http_status(200)
    expect(response.parsed_body['audience_follows']).to be_nil
    Kronk::EventLinks.link!(event, weavers, author.account)
    expect(audience_of(album)).to eq(tier: 'self_only', krew_ids: [growers.id])
  end

  it 'stops following when its owner changes its audience by hand' do
    event = growers_event
    id = follow(author, 'albutts', album.id, 'kalendar', event.id)['id']
    put "/api/v1/albutts/albums/#{album.id}", headers: headers_for(author), params: { album: { visibility: 'mates' } }

    expect(response).to have_http_status(200)
    expect(KornerAttachment.find(id).metadata).to be_blank
    Kronk::EventLinks.link!(event, weavers, author.account)
    expect(audience_of(album)[:tier]).to eq('mates')
  end

  it 'refuses to follow a Mates-only event' do
    event = create_event(visibility: 'mates')
    follow(author, 'albutts', album.id, 'kalendar', event.id)

    expect(response).to have_http_status(422)
    expect(response.parsed_body['error']).to include('Mates and Orbit')
    expect(KornerAttachment.count).to eq(0)
    expect(audience_of(album)[:tier]).to eq('public')
  end

  it "refuses a Krew audience whose Krews the follower's owner isn't in" do
    event = create_event(visibility: 'self_only', krew_ids: [growers.id, weavers.id])
    film = Film.create!(owner: member.account, title: 'Harvest film', visibility: :public)
    follow(member, 'cinema', film.id, 'kalendar', event.id)

    expect(response).to have_http_status(422)
    expect(response.parsed_body['error']).to include('not in every Krew')
  end

  it 'never lets a Booth set follow, or be followed' do
    set = Fabricate(:booth_set, account: author.account, published: true)
    event = create_event(visibility: 'public')
    follow(author, 'booth', set.id, 'kalendar', event.id)
    expect(response).to have_http_status(422)
    expect(response.parsed_body['error']).to include('always public')

    follow(author, 'albutts', album.id, 'booth', set.id)
    expect(response).to have_http_status(422)
  end

  it 'lets only whoever looks after the follower set it' do
    event = growers_event
    attachment = KornerAttachment.create!(source_slug: 'albutts', source_id: album.id, target_slug: 'kalendar', target_id: event.id,
                                          kind: 'link', created_by_account: author.account)

    patch "/api/v1/attachments/#{attachment.id}", headers: headers_for(member), params: { audience_follows: 'target' }
    expect(response).to have_http_status(403)

    patch "/api/v1/attachments/#{attachment.id}", headers: headers_for(author), params: { audience: 'same' }
    expect(response).to have_http_status(200)
    expect(attachment.reload.metadata).to eq('audience_follows' => 'target')
  end

  it 'ignores a follow flag written straight into the metadata' do
    post '/api/v1/attachments', headers: headers_for(author), params: {
      source_slug: 'albutts', source_id: album.id, target_slug: 'kalendar', target_id: create_event(visibility: 'mates').id,
      kind: 'link', metadata: { audience_follows: 'target', note: 'hi' }
    }

    expect(response).to have_http_status(200)
    expect(response.parsed_body['metadata']).to eq('note' => 'hi')
  end

  it 'follows one record at a time' do
    first = growers_event
    second = create_event(visibility: 'public')
    a = follow(author, 'albutts', album.id, 'kalendar', first.id)['id']
    follow(author, 'albutts', album.id, 'kalendar', second.id)

    expect(KornerAttachment.find(a).metadata).to be_blank
    expect(audience_of(album)[:tier]).to eq('public')
  end

  it 'gives every row both audiences, and its record says what it follows' do
    event = growers_event
    follow(author, 'albutts', album.id, 'kalendar', event.id)

    get '/api/v1/attachments', headers: headers_for(member), params: { target: "kalendar/#{event.id}" }
    row = response.parsed_body.first
    expect(row['audience_follows']).to eq('target')
    expect(row['target']['audience']).to include('tier' => 'self_only', 'followable' => true,
                                                 'krews' => [{ 'id' => growers.id.to_s, 'name' => 'Growers', 'slug' => 'growers' }])
    expect(row['source']['audience']).to include('tier' => 'self_only', 'hidden_krews' => 0)

    get "/api/v1/albutts/albums/#{album.id}", headers: headers_for(member)
    expect(response.parsed_body['audience_follows']).to include('slug' => 'kalendar', 'id' => event.id.to_s, 'title' => 'Harvest')
  end

  it 'tells a composer what it could follow before its record exists' do
    event = growers_event

    get '/api/v1/attachments/audience', headers: headers_for(author), params: { korner: 'kalendar', id: event.id, for: 'albutts' }
    expect(response.parsed_body).to include('followable' => true, 'tier' => 'self_only', 'title' => 'Harvest', 'reason' => nil)

    get '/api/v1/attachments/audience', headers: headers_for(author), params: { korner: 'kalendar', id: event.id, for: 'booth' }
    expect(response.parsed_body).to include('followable' => false, 'reason' => 'a Booth set is always public')

    get '/api/v1/attachments/audience', headers: headers_for(stranger), params: { korner: 'kalendar', id: event.id }
    expect(response).to have_http_status(404)
  end
end
