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

  # decisions.md, 2026-11-11: a call in the Krew's own Kuddle.
  it "holds its call in the Krew's own Kuddle, open to its members", :aggregate_failures do
    event = create_event('Meeting', visibility: 'self_only', krew_ids: [krew.id], kuddle_space: "krew:#{krew.id}")

    kuddle = HuddleSession.spaces.find_by!(krew: krew)
    expect(KornerAttachment.where(source_slug: 'kalendar', source_id: event['id'], target_slug: 'huddle', target_id: kuddle.id)).to exist

    get "/api/v1/events/#{event['id']}", headers: headers_for(member)
    expect(response.parsed_body['kuddle']).to eq('id' => kuddle.id.to_s, 'title' => 'Gardeners')
  end

  it "doesn't use a Krew's Kuddle for someone outside it" do
    post '/api/v1/events', headers: headers_for(stranger), params: { title: 'Gatecrash', start_time: 2.days.from_now.iso8601, kuddle_space: "krew:#{krew.id}" }

    expect(response).to have_http_status(200)
    expect(HuddleSession.spaces.where(krew: krew)).to be_empty
  end

  it 'lists it for members and not for anyone else' do
    create_event('Working bee', visibility: 'self_only', krew_ids: [krew.id])
    create_event('Open day', visibility: 'public')

    expect(titles_for(member)).to contain_exactly('Working bee', 'Open day')
    expect(titles_for(stranger)).to contain_exactly('Open day')
  end

  # decisions.md, 2026-11-18: inviting the Krew is the host's choice.
  it 'invites nobody unless the host asks for the whole Krew' do
    event = create_event('Working bee', visibility: 'self_only', krew_ids: [krew.id])

    expect(EventInvitation.where(event_id: event['id'])).to be_empty
  end

  it 'invites everyone in the Krew when asked, but not the host' do
    event = create_event('Working bee', visibility: 'self_only', krew_ids: [krew.id], invite_krew_members: true)

    invited = EventInvitation.where(event_id: event['id']).pluck(:account_id)
    expect(invited).to contain_exactly(member.account.id)
    expect(Notification.where(account: member.account, type: :event_invitation)).to exist
  end

  it 'invites the Krew to a public event it hosts too, when asked' do
    event = create_event('Open day', visibility: 'public', krew_ids: [krew.id], invite_krew_members: true)

    expect(EventInvitation.where(event_id: event['id']).pluck(:account_id)).to contain_exactly(member.account.id)
  end

  it 'invites nobody from a Krew the host is not in' do
    other = Krew.create!(slug: 'bakers', name: 'Bakers', access: 'open')
    other.krew_memberships.create!(account: stranger.account)

    event = create_event('Bake off', visibility: 'public', krew_ids: [other.id], invite_krew_members: true)

    expect(EventInvitation.where(event_id: event['id'])).to be_empty
  end

  describe 'inviting people' do
    def invite(event, *accounts)
      post "/api/v1/events/#{event['id']}/invite", headers: headers_for(author), params: { account_ids: accounts.map(&:id) }
    end

    it 'says an event for the Krew alone is for its members' do
      event = create_event('Working bee', visibility: 'self_only', krew_ids: [krew.id])

      expect(event['krew_only']).to be(true)
      expect(create_event('Open day', visibility: 'public', krew_ids: [krew.id])['krew_only']).to be(false)
    end

    it 'invites a member to an event for the Krew alone' do
      event = create_event('Working bee', visibility: 'self_only', krew_ids: [krew.id])
      invite(event, member.account)

      expect(response).to have_http_status(200)
      expect(EventInvitation.where(event_id: event['id']).pluck(:account_id)).to contain_exactly(member.account.id)
    end

    it 'refuses anyone outside the Krew, and invites nobody', :aggregate_failures do
      event = create_event('Working bee', visibility: 'self_only', krew_ids: [krew.id])
      invite(event, member.account, stranger.account)

      expect(response).to have_http_status(422)
      expect(response.parsed_body['error']).to match(/Krew alone/)
      expect(EventInvitation.where(event_id: event['id'])).to be_empty
    end

    it 'invites anyone to an event the Krew hosts in the open' do
      event = create_event('Open day', visibility: 'public', krew_ids: [krew.id])
      invite(event, stranger.account)

      expect(response).to have_http_status(200)
      expect(EventInvitation.where(event_id: event['id']).pluck(:account_id)).to contain_exactly(stranger.account.id)
    end
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
