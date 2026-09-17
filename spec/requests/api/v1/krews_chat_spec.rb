# frozen_string_literal: true

require 'rails_helper'

# GET /api/v1/krews/:id/chat — ensures + returns the Krew's group-chat
# (Nudges KREW) conversation id. Members only.
RSpec.describe 'API V1 Krews chat' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:krew) do
    Krew.create!(slug: 'testers', name: 'Testers', access: 'open',
                 seeded_by: user.account, last_activity_at: Time.current)
  end

  context 'when the viewer is a member' do
    before do
      krew.krew_memberships.create!(account: user.account, role: 'seeder', source: 'direct')
    end

    it 'returns the krew conversation id' do
      get "/api/v1/krews/#{krew.slug}/chat", headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body[:conversation_id]).to eq(
        Nudges::Conversation.krew_for!(krew).id.to_s
      )
    end
  end

  context 'when the viewer is not a member' do
    it 'is forbidden' do
      get "/api/v1/krews/#{krew.slug}/chat", headers: headers
      expect(response).to have_http_status(403)
    end
  end
end
