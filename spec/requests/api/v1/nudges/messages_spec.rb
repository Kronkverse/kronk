# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Nudges conversation messages' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:notifications') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:other)   { Fabricate(:account) }
  let(:conversation) { Fabricate(:nudges_conversation, one: user.account, two: other) }

  def make_mates!
    Fabricate(:follow, account: user.account, target_account: other)
    Fabricate(:follow, account: other, target_account: user.account)
  end

  describe 'POST /api/v1/nudges/conversations/:conversation_id/messages' do
    it 'creates a message and serializes it (201)' do
      make_mates!

      post "/api/v1/nudges/conversations/#{conversation.id}/messages",
           params: { body: 'hey there' }, headers: headers

      expect(response).to have_http_status(201)
      expect(response.parsed_body[:body]).to eq('hey there')
      expect(conversation.messages.count).to eq(1)
    end

    it 'rejects a message with neither body nor attachment' do
      make_mates!
      post "/api/v1/nudges/conversations/#{conversation.id}/messages",
           params: { body: '   ' }, headers: headers

      expect(response).to have_http_status(422)
    end

    # "Only Mates can start one" — held here too, for an empty Mate chat
    # that exists between two people who are not Mates.
    context 'when the chat is empty and the two are not Mates' do
      it 'refuses the first message' do
        post "/api/v1/nudges/conversations/#{conversation.id}/messages",
             params: { body: 'hello stranger' }, headers: headers

        expect(response).to have_http_status(403)
        expect(conversation.messages.count).to eq(0)
      end

      it 'lets a chat that already has messages carry on' do
        Fabricate(:nudges_conversation_message, conversation: conversation, author_account: other)

        post "/api/v1/nudges/conversations/#{conversation.id}/messages",
             params: { body: 'still here' }, headers: headers

        expect(response).to have_http_status(201)
      end
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
