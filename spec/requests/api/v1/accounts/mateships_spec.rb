# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Accounts Mateship' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:follows') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:viewer)  { user.account }
  let(:mate)    { Fabricate(:account) }
  # Mate of both: shows as a Matual.
  let(:chris)   { Fabricate(:account, username: 'chris') }
  # Mate of the viewer only.
  let(:dana)    { Fabricate(:account, username: 'dana') }

  def make_mates(one, other)
    one.follow!(other)
    other.follow!(one)
  end

  before do
    make_mates(viewer, mate)
    make_mates(viewer, chris)
    make_mates(mate, chris)
    make_mates(viewer, dana)
  end

  describe 'GET /api/v1/accounts/:account_id/mateship' do
    it 'shows a Mate when you became Mates and who you have in common', :aggregate_failures do
      get "/api/v1/accounts/#{mate.id}/mateship", headers: headers

      expect(response).to have_http_status(200)
      body = response.parsed_body
      expect(body[:since]).to be_present
      expect(body[:matuals_count]).to eq 1
      expect(body[:matuals]).to contain_exactly(hash_including(id: chris.id.to_s, acct: 'chris'))
    end

    it 'dates the Mateship from the second follow' do
      Follow.find_by(account: viewer, target_account: mate).update_columns(created_at: 3.days.ago)
      accepted = 1.day.ago.change(usec: 0)
      Follow.find_by(account: mate, target_account: viewer).update_columns(created_at: accepted)

      get "/api/v1/accounts/#{mate.id}/mateship", headers: headers

      expect(Time.zone.parse(response.parsed_body[:since])).to eq accepted
    end

    it 'lists the Krews, events and projekts you are both in', :aggregate_failures do
      krew = Fabricate(:krew, seeded_by: viewer)
      krew.krew_memberships.create!(account: mate, role: 'member', source: 'direct')
      Fabricate(:krew, seeded_by: viewer) # only the viewer's

      picnic = Event.create!(account: viewer, title: 'Picnic', start_time: 2.days.from_now)
      EventRsvp.create!(event: picnic, account: viewer, status: :going)
      EventRsvp.create!(event: picnic, account: mate, status: :going)
      maybe = Event.create!(account: viewer, title: 'Maybe', start_time: 3.days.from_now)
      EventRsvp.create!(event: maybe, account: viewer, status: :going)
      EventRsvp.create!(event: maybe, account: mate, status: :interested)

      doof = Freethedream::Project.create!(title: 'Doof', owner: viewer)
      doof.add_member!(mate)

      get "/api/v1/accounts/#{mate.id}/mateship", headers: headers

      body = response.parsed_body
      # Doof's own Krew is one they're both in too.
      expect(body[:krews].pluck(:id)).to contain_exactly(krew.id.to_s, doof.reload.krew_id.to_s)
      expect(body[:events]).to contain_exactly(hash_including(id: picnic.id.to_s, title: 'Picnic'))
      expect(body[:projekts]).to contain_exactly(hash_including(id: doof.id.to_s, title: 'Doof', krew_slug: doof.krew.slug))
    end

    it 'leaves out an invite-only event the viewer was not invited to' do
      supper = Event.create!(account: chris, title: 'Secret supper', start_time: 2.days.from_now, invite_only: true)
      EventRsvp.create!(event: supper, account: viewer, status: :going)
      EventRsvp.create!(event: supper, account: mate, status: :going)

      get "/api/v1/accounts/#{mate.id}/mateship", headers: headers

      expect(response.parsed_body[:events]).to be_empty
    end

    it 'leaves out a projekt only the Mate is in' do
      Freethedream::Project.create!(title: 'Theirs', owner: mate)

      get "/api/v1/accounts/#{mate.id}/mateship", headers: headers

      expect(response.parsed_body[:projekts]).to be_empty
    end

    it 'shows no Matuals when the Mate hides their connections' do
      mate.update!(hide_collections: true)

      get "/api/v1/accounts/#{mate.id}/mateship", headers: headers

      expect(response.parsed_body).to include(matuals: [], matuals_count: 0)
    end

    it 'is not found for someone who is not your Mate' do
      stranger = Fabricate(:account)
      stranger.follow!(viewer)

      get "/api/v1/accounts/#{stranger.id}/mateship", headers: headers

      expect(response).to have_http_status(404)
    end

    it 'is not found for your own account' do
      get "/api/v1/accounts/#{viewer.id}/mateship", headers: headers

      expect(response).to have_http_status(404)
    end

    it 'needs a signed-in user' do
      get "/api/v1/accounts/#{mate.id}/mateship"

      expect(response).to have_http_status(401)
    end
  end
end
