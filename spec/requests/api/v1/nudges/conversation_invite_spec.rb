# frozen_string_literal: true

require 'rails_helper'

# Accepting a Krew-chat invite joins the Krew + activates the membership;
# declining drops the pending membership without joining.
RSpec.describe 'API V1 Nudges conversation invite' do
  let(:seeder)  { Fabricate(:user).account }
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:krew) do
    Krew.create!(slug: 'testers', name: 'Testers', access: 'invite_only',
                 seeded_by: seeder, last_activity_at: Time.current).tap do |k|
      k.krew_memberships.create!(account: seeder, role: 'seeder', source: 'direct')
    end
  end
  let(:convo) { Nudges::Conversation.invite_to_krew!(krew, user.account, seeder) }

  it 'accepts: joins the krew and activates the membership' do
    post "/api/v1/nudges/conversations/#{convo.id}/accept_invite", headers: headers

    expect(response).to have_http_status(200)
    expect(krew.reload.members).to include(user.account)
    membership = convo.memberships.find_by(account_id: user.account.id)
    expect(membership.pending?).to be(false)
    expect(membership.accepted_at).to be_present
  end

  it 'declines: drops the pending membership without joining' do
    post "/api/v1/nudges/conversations/#{convo.id}/decline_invite", headers: headers

    expect(response).to have_http_status(200)
    expect(convo.memberships.find_by(account_id: user.account.id)).to be_nil
    expect(krew.reload.members).to_not include(user.account)
  end
end
