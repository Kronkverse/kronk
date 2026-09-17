# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Nudges conversation messages' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:notifications') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:other)   { Fabricate(:account) }
  let(:conversation) { Fabricate(:nudges_conversation, one: user.account, two: other) }

  describe 'POST /api/v1/nudges/conversations/:conversation_id/messages' do
    it 'creates a message and serializes it (201)' do
      post "/api/v1/nudges/conversations/#{conversation.id}/messages",
           params: { body: 'hey there' }, headers: headers

      expect(response).to have_http_status(201)
      expect(response.parsed_body[:body]).to eq('hey there')
      expect(conversation.messages.count).to eq(1)
    end

    it 'rejects a message with neither body nor attachment' do
      post "/api/v1/nudges/conversations/#{conversation.id}/messages",
           params: { body: '   ' }, headers: headers

      expect(response).to have_http_status(422)
    end

    it 'returns 404 to a non-participant' do
      stranger = Fabricate(:user)
      stranger_token = Fabricate(:accessible_access_token, resource_owner_id: stranger.id, scopes: 'write:notifications')

      post "/api/v1/nudges/conversations/#{conversation.id}/messages",
           params: { body: 'hi' }, headers: { 'Authorization' => "Bearer #{stranger_token.token}" }

      expect(response).to have_http_status(404)
    end
  end
end
