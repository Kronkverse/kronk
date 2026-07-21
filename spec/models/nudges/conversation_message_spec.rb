# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::ConversationMessage do
  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }
  let(:convo) { Nudges::Conversation.mate_between!(alice, bob) }

  describe 'creation' do
    it 'accepts a text-only message' do
      msg = described_class.create!(conversation: convo, author_account: alice, body: 'hi')
      expect(msg).to be_persisted
    end

    it 'rejects a message with neither body nor attachment' do
      msg = described_class.new(conversation: convo, author_account: alice)
      expect(msg).to_not be_valid
      expect(msg.errors[:base]).to include('body or attachment required')
    end
  end

  describe 'side effects on create' do
    it 'bumps the conversation last_activity_at' do
      convo.update!(last_activity_at: 1.day.ago)
      expect do
        described_class.create!(conversation: convo, author_account: alice, body: 'hi')
      end.to(change { convo.reload.last_activity_at })
    end

    it 'increments the Mate relationship counter' do
      expect do
        described_class.create!(conversation: convo, author_account: alice, body: 'hi')
      end.to change { Nudges::Relationship.for_pair(alice.id, bob.id).message_count }.by(1)
    end

    it 'inherits expiry from the conversation' do
      convo.update!(expires_at: 1.hour.from_now)
      msg = described_class.create!(conversation: convo, author_account: alice, body: 'hi')
      expect(msg.expires_at).to be_within(1.second).of(convo.expires_at)
    end
  end

  describe 'reactions' do
    let(:msg) { described_class.create!(conversation: convo, author_account: alice, body: 'hi') }

    it 'appends a reaction' do
      msg.add_reaction!(bob, '👍')
      expect(msg.reload.reactions.pluck('symbol')).to eq(['👍'])
    end

    it 'caps distinct symbols at 3' do
      msg.add_reaction!(alice, '👍')
      msg.add_reaction!(alice, '❤️')
      msg.add_reaction!(alice, '🎉')
      expect do
        msg.add_reaction!(bob, '🔥')
      end.to raise_error(described_class::ReactionCapReached)
    end

    it 'allows a 4th account to reuse an existing symbol' do
      msg.add_reaction!(alice, '👍')
      msg.add_reaction!(alice, '❤️')
      msg.add_reaction!(alice, '🎉')
      expect do
        msg.add_reaction!(bob, '👍') # same symbol, distinct account — still 3 distinct
      end.to_not raise_error
    end

    it 'removes a reaction' do
      msg.add_reaction!(alice, '👍')
      msg.remove_reaction!(alice, '👍')
      expect(msg.reload.reactions).to be_empty
    end
  end
end
