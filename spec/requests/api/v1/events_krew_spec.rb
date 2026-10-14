# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kalendar.md, Events for a Krew: an event made for a Krew alone
# is seen by its members and nobody else, in the list as on its own page.
RSpec.describe 'Events for a Krew' do
  let(:author)   { Fabricate(:user) }
  let(:member)   { Fabricate(:user) }
  let(:stranger) { Fabricate(:user) }
  let(:krew)     { Krew.create!(slug: 'gardeners', name: 'Gardeners', access: 'open') }

  before do
    krew.krew_memberships.create!(account: author.account)
    krew.krew_memberships.create!(account: member.account)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def create_event(title, **params)
    post '/api/v1/events', headers: headers_for(author), params: { title: title, start_time: 2.days.from_now.iso8601, **params }
    response.parsed_body
  end

  def titles_for(user, **params)
    get '/api/v1/events', headers: headers_for(user), params: params
    response.parsed_body.pluck('title')
  end

  it 'makes an event for the Krew alone, which says whose it is' do
    event = create_event('Working bee', visibility: 'self_only', krew_ids: [krew.id])

    expect(response).to have_http_status(200)
    expect(event).to include('visibility' => 'self_only', 'krews' => [{ 'id' => krew.id.to_s, 'name' => 'Gardeners' }])
  end

  it 'lists it for members and not for anyone else' do
    create_event('Working bee', visibility: 'self_only', krew_ids: [krew.id])
    create_event('Open day', visibility: 'public')

    expect(titles_for(member)).to contain_exactly('Working bee', 'Open day')
    expect(titles_for(stranger)).to contain_exactly('Open day')
  end

  it 'gives a Krew its own events' do
    create_event('Working bee', visibility: 'self_only', krew_ids: [krew.id])
    create_event('Open day', visibility: 'public')

    expect(titles_for(member, krew_id: krew.id)).to contain_exactly('Working bee')
    expect(titles_for(stranger, krew_id: krew.id)).to be_empty
  end

  it 'keeps a Mates event out of the list of someone who is not a Mate' do
    create_event('Dinner', visibility: 'mates')

    expect(titles_for(stranger)).to be_empty
    expect(titles_for(author)).to contain_exactly('Dinner')
  end
end
