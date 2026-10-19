# frozen_string_literal: true

require 'rails_helper'

# Privacy gaps closed before 2.1.0: blocks reach Booth, Wachuneed and event
# attendees; a person's Mates follow their profile's visibility; an
# invite-only Krew is named only to its members.
RSpec.describe 'Privacy before 2.1.0' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:blocker) { Fabricate(:account) }

  describe 'blocks' do
    before { blocker.block!(me) }

    it "hides a blocker's Booth sets" do
      set = Fabricate(:booth_set, account: blocker, published: true)

      get '/api/v1/booth_sets', headers: headers
      expect(response.parsed_body.pluck('id')).to_not include(set.id.to_s)

      get "/api/v1/booth_sets/#{set.id}", headers: headers
      expect(response).to have_http_status(404)
    end

    it "hides a blocker's Wachuneed listings" do
      listing = Listing.create!(account: blocker, title: 'Soap', category: 'goods', state: 'live')

      get '/api/v1/wachuneed/listings', headers: headers
      expect(response.parsed_body.pluck('id')).to_not include(listing.id.to_s)

      get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers
      expect(response).to have_http_status(404)
    end

    it 'leaves a blocker out of the attendees of an event' do
      event = Event.create!(account: me, title: 'Picnic', start_time: 2.days.from_now)
      event.rsvps.create!(account: blocker, status: :going)
      event.rsvps.create!(account: Fabricate(:account), status: :going)

      get "/api/v1/events/#{event.id}/attendees", headers: headers
      expect(response.parsed_body.pluck('id')).to_not include(blocker.id.to_s)
      expect(response.parsed_body.size).to eq 1
    end
  end

  describe 'Mates of someone whose profile you may not see' do
    let(:account) { Fabricate(:account, profile_visibility: :mates) }

    before do
      mate = Fabricate(:account)
      mate.follow!(account)
      account.follow!(mate)
    end

    it 'are not listed' do
      get "/api/v1/accounts/#{account.id}/mates", headers: headers

      expect(response.parsed_body).to eq []
    end
  end

  describe 'an invite-only Krew on a public post' do
    let(:krew) do
      Krew.create!(slug: 'hidden', name: 'Hidden', access: 'invite_only', seeded_by: Fabricate(:account), last_activity_at: Time.current)
    end
    let(:status) { Fabricate(:status, visibility: :public).tap { |s| krew.statuses << s } }

    it 'is not named to someone outside it' do
      get "/api/v1/statuses/#{status.id}", headers: headers

      expect(response.parsed_body['krews']).to eq []
    end

    it 'is named to its members' do
      krew.krew_memberships.create!(account: me, role: 'member', source: 'direct')

      get "/api/v1/statuses/#{status.id}", headers: headers

      expect(response.parsed_body['krews'].pluck('slug')).to eq ['hidden']
    end
  end
end
