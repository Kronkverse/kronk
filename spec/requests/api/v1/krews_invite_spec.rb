# frozen_string_literal: true

require 'rails_helper'

# Krew invites (create-time People section) — the chat-request flow: each
# selected local account is added to the Krew's group chat as a PENDING member
# (a request in their Nudges), not force-added and not a directed nudge.
RSpec.describe 'API V1 Krews create — invites' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let!(:invitee) { Fabricate(:user, account_attributes: { username: 'invited' }).account }

  def create_krew(extra = {})
    post '/api/v1/krews', headers: headers, params: {
      name: 'Snowgum Skip',
      slug: 'snowgum-skip',
      access: 'invite_only',
    }.merge(extra)
  end

  it 'adds each invited account to the krew chat as a pending request' do
    create_krew(invite_account_ids: [invitee.id])
    expect(response).to have_http_status(200)

    convo = Nudges::Conversation.krew.find_by(krew: Krew.find_by(slug: 'snowgum-skip'))
    membership = convo.memberships.find_by(account_id: invitee.id)
    expect(membership).to be_present
    expect(membership.pending?).to be(true)
    expect(membership.invited_by_account_id).to eq(user.account.id)
  end

  it 'does not make the invitee a krew member yet' do
    create_krew(invite_account_ids: [invitee.id])
    expect(Krew.find_by(slug: 'snowgum-skip').members).to_not include(invitee)
  end

  it 'never creates a pending invite for the seeder' do
    create_krew(invite_account_ids: [user.account.id])
    expect(Nudges::ConversationMembership.pending.where(account_id: user.account.id)).to be_empty
  end
end
