# frozen_string_literal: true

require 'rails_helper'

# Asking to join an `approval` Krew, and inviting people into a Krew that
# already exists. Any member answers a request, not only the seeder.
RSpec.describe 'API V1 Krews join requests and invites' do
  let(:seeder)  { Fabricate(:user).account }
  let(:member)  { Fabricate(:user) }
  let(:asker)   { Fabricate(:user) }

  let(:krew) do
    Krew.create!(slug: 'testers', name: 'Testers', access: 'approval', invite_token: 'letmein',
                 seeded_by: seeder, last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: seeder, role: 'seeder', source: 'direct')
      k.krew_memberships.create!(account: member.account, role: 'member', source: 'direct')
    end
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  describe 'POST /api/v1/krews/:id/join on an approval Krew' do
    it 'leaves a request instead of a membership' do
      post "/api/v1/krews/#{krew.slug}/join", headers: headers_for(asker)

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include(viewer_requested: true, viewer_role: nil)
      expect(krew.reload.members).to_not include(asker.account)
      expect(krew.krew_join_requests.pluck(:account_id)).to eq([asker.account.id])
    end

    it 'tells each member once, however many times the asker asks' do
      events = []
      allow(Kronk::KornerEvents).to receive(:publish).and_wrap_original do |original, name, **payload|
        events << [name, payload[:recipient_account_id]] if name == 'krews.join.requested'
        original.call(name, **payload)
      end

      2.times { post "/api/v1/krews/#{krew.slug}/join", headers: headers_for(asker) }

      expect(events).to contain_exactly(
        ['krews.join.requested', seeder.id],
        ['krews.join.requested', member.account.id]
      )
    end

    it 'joins directly with the invite link token' do
      post "/api/v1/krews/#{krew.slug}/join", headers: headers_for(asker), params: { k: 'letmein' }

      expect(response).to have_http_status(200)
      expect(krew.reload.members).to include(asker.account)
      expect(krew.krew_join_requests).to be_empty
    end
  end

  describe 'answering a request' do
    let!(:join_request) { krew.krew_join_requests.create!(account: asker.account) }

    it 'lists the requests to a member who is not the seeder' do
      get "/api/v1/krews/#{krew.slug}/join_requests", headers: headers_for(member)

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to contain_exactly(
        include(id: join_request.id.to_s, account: include(id: asker.account.id.to_s))
      )
    end

    it 'does not list them to someone outside the Krew' do
      get "/api/v1/krews/#{krew.slug}/join_requests", headers: headers_for(asker)

      expect(response).to have_http_status(403)
    end

    it 'shows the count to members only' do
      get "/api/v1/krews/#{krew.slug}", headers: headers_for(member)
      expect(response.parsed_body[:join_request_count]).to eq(1)

      get "/api/v1/krews/#{krew.slug}", headers: headers_for(asker)
      expect(response.parsed_body[:join_request_count]).to eq(0)
    end

    it 'lets any member accept: the asker joins and the request goes' do
      post "/api/v1/krews/#{krew.slug}/join_requests/#{join_request.id}/accept", headers: headers_for(member)

      expect(response).to have_http_status(200)
      expect(krew.reload.members).to include(asker.account)
      expect(krew.krew_join_requests).to be_empty
    end

    it 'does not let a non-member accept' do
      outsider = Fabricate(:user)
      post "/api/v1/krews/#{krew.slug}/join_requests/#{join_request.id}/accept", headers: headers_for(outsider)

      expect(response).to have_http_status(403)
      expect(krew.reload.members).to_not include(asker.account)
    end

    it 'declines: the request goes and nobody joins' do
      post "/api/v1/krews/#{krew.slug}/join_requests/#{join_request.id}/decline", headers: headers_for(member)

      expect(response).to have_http_status(200)
      expect(krew.reload.krew_join_requests).to be_empty
      expect(krew.members).to_not include(asker.account)
    end

    it 'lets the asker take their request back' do
      delete "/api/v1/krews/#{krew.slug}/join_request", headers: headers_for(asker)

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include(viewer_requested: false)
      expect(krew.reload.krew_join_requests).to be_empty
    end
  end

  describe 'POST /api/v1/krews/:id/invites' do
    let(:invitee) { Fabricate(:user).account }

    it 'lets any member invite: a pending request in the Krew chat, not a membership' do
      post "/api/v1/krews/#{krew.slug}/invites", headers: headers_for(member), params: { account_ids: [invitee.id] }

      expect(response).to have_http_status(200)
      expect(response.parsed_body[:invited_account_ids]).to eq([invitee.id.to_s])

      membership = Nudges::Conversation.krew.find_by(krew: krew).memberships.find_by(account_id: invitee.id)
      expect(membership.pending?).to be(true)
      expect(membership.invited_by_account_id).to eq(member.account.id)
      expect(krew.reload.members).to_not include(invitee)
    end

    it 'refuses someone who is not in the Krew' do
      post "/api/v1/krews/#{krew.slug}/invites", headers: headers_for(asker), params: { account_ids: [invitee.id] }

      expect(response).to have_http_status(403)
    end

    it 'skips people already in, and people who have blocked the inviter' do
      invitee.block!(member.account)

      post "/api/v1/krews/#{krew.slug}/invites", headers: headers_for(member), params: { account_ids: [invitee.id, seeder.id] }

      expect(response.parsed_body[:invited_account_ids]).to be_empty
    end
  end
end
