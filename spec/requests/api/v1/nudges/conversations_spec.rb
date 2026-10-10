# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Nudges conversations' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:notifications') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:other)   { Fabricate(:account) }

  describe 'GET /api/v1/nudges/conversations' do
    it 'lists a Mate chat that has a message in it' do
      conversation = Fabricate(:nudges_conversation, one: me, two: other)
      Fabricate(:nudges_conversation_message, conversation: conversation, author_account: other)

      get '/api/v1/nudges/conversations', headers: headers

      expect(response.parsed_body.pluck(:id)).to eq([conversation.id.to_s])
    end

    # Notifications used to be filed in a chat with whoever did the thing,
    # which left a chat behind for every stranger who frothed a post.
    it 'leaves out a Mate chat nobody has written in' do
      Fabricate(:nudges_conversation, one: me, two: other)

      get '/api/v1/nudges/conversations', headers: headers

      expect(response.parsed_body).to be_empty
    end

    it 'does not count a notification as unread in a chat' do
      conversation = Fabricate(:nudges_conversation, one: me, two: other)
      Fabricate(:nudges_conversation_message, conversation: conversation, author_account: me)
      Fabricate(:nudges_event, conversation: nil, actor_account: other, recipient_account: me)

      get '/api/v1/nudges/conversations', headers: headers

      expect(response.parsed_body.first[:unread_count]).to eq(0)
    end
  end
end
