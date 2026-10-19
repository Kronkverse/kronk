# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 link previews' do
  let(:alice) { Fabricate(:user) }
  let(:bob)   { Fabricate(:user) }

  def previews(user, *urls)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses')
    get '/api/v1/link_previews', params: { urls: urls }, headers: { 'Authorization' => "Bearer #{token.token}" }
    response.parsed_body.to_h { |row| [row['url'], row['preview']] }
  end

  def local(path)
    "https://#{Rails.configuration.x.local_domain}#{path}"
  end

  it 'refuses signed-out requests' do
    get '/api/v1/link_previews', params: { urls: ['/hub/albutts/albums/1'] }
    expect(response).to have_http_status(401)
  end

  it 'previews a public album, by full URL or path, for anyone', :aggregate_failures do
    album = Album.create!(owner: alice.account, title: 'Bush doof', description: '<p>Three days out west</p>', visibility: :public)

    by_url = previews(bob, local("/hub/albutts/albums/#{album.id}"))[local("/hub/albutts/albums/#{album.id}")]
    expect(by_url).to include('korner' => 'albutts', 'title' => 'Bush doof', 'summary' => 'Three days out west', 'url' => "/hub/albutts/albums/#{album.id}")

    expect(previews(bob, "/hub/albutts/albums/#{album.id}").values.first).to include('title' => 'Bush doof')
  end

  it 'shows a private thing only to who can see it', :aggregate_failures do
    album = Album.create!(owner: alice.account, title: 'Just mine', visibility: :self_only)
    path = "/hub/albutts/albums/#{album.id}"

    expect(previews(alice, path)[path]).to include('title' => 'Just mine')
    expect(previews(bob, path)[path]).to be_nil
  end

  # An event with no feed post is its author's and invitees' only
  # (Event#visible_to?), which the preview follows.
  it 'previews a Kalendar event with its time, for who can see it', :aggregate_failures do
    event = Event.create!(account: alice.account, title: 'Full moon swim', start_time: 2.days.from_now, end_time: 2.days.from_now + 2.hours)
    path = "/hub/kalendar/#{event.id}"

    expect(previews(alice, path)[path]).to include('korner' => 'kalendar', 'title' => 'Full moon swim', 'when' => event.start_time.iso8601)
    expect(previews(bob, path)[path]).to be_nil
  end

  it 'previews a FreeTheDream item, which is not the korner’s primary resource' do
    project = Freethedream::Project.create!(owner: alice.account, title: 'Mini Doof')
    item = Freethedream::Item.create!(root: project, owner: alice.account, kind: :need, title: 'Gas bottle', quantity: 2)
    path = "/hub/freethedream/i/#{item.id}"

    expect(previews(bob, path)[path]).to include('korner' => 'freethedream', 'title' => 'Gas bottle')
  end

  it 'gives nothing for other sites, korner roots, unknown korners and missing things', :aggregate_failures do
    urls = ['https://example.com/hub/albutts/albums/1', '/hub/albutts', '/hub/nowhere/1', '/hub/albutts/albums/0', '/home']
    expect(previews(bob, *urls).values).to all(be_nil)
  end
end
