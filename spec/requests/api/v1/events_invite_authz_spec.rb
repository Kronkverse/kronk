# frozen_string_literal: true

require 'rails_helper'

# Authorization guard on event invitations. Only the event owner may invite
# accounts — otherwise any user could spam invitations from someone else's event.
RSpec.describe 'Api::V1::Events invite authorization' do
  let(:owner)   { Fabricate(:account) }
  let(:event)   { Event.create!(account: owner, title: 'Gathering', start_time: 1.day.from_now) }
  let(:invitee) { Fabricate(:account) }

  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'POST /api/v1/events/:id/invite as a stranger' do
    let(:stranger) { Fabricate(:user) }
    let(:token)    { Fabricate(:accessible_access_token, resource_owner_id: stranger.id, scopes: 'read write') }

    it 'is forbidden and creates no invitation' do
      expect do
        post "/api/v1/events/#{event.id}/invite", params: { account_ids: [invitee.id] }, headers: headers
      end.to_not(change { event.invitations.count })

      expect(response).to have_http_status(403)
    end
  end

  describe 'POST /api/v1/events/:id/invite as the owner' do
    let(:owner_user) { Fabricate(:user, account: owner) }
    let(:token)      { Fabricate(:accessible_access_token, resource_owner_id: owner_user.id, scopes: 'read write') }

    it 'creates the invitation' do
      expect do
        post "/api/v1/events/#{event.id}/invite", params: { account_ids: [invitee.id] }, headers: headers
      end.to change { event.invitations.count }.from(0).to(1)

      expect(response).to have_http_status(200)
    end
  end
end
