# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::Conversation do
  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }

  describe '.mate_between!' do
    it 'creates a conversation with sorted account ids regardless of argument order' do
      convo1 = described_class.mate_between!(alice, bob)
      convo2 = described_class.mate_between!(bob, alice)

      expect(convo1).to eq(convo2)
      expect(convo1.account_a_id).to be < convo1.account_b_id
    end

    it 'refuses same-account pairs' do
      expect { described_class.mate_between!(alice, alice) }.to raise_error(ArgumentError)
    end
  end

  describe 'validations' do
    it 'refuses unsorted account pair (defense in depth)' do
      # Skip the sorted factory helper; simulate a raw *unsorted* write.
      # (A plain account_a: bob relies on lazy `let` evaluation order and
      # can land already-sorted — force the higher id into account_a.)
      higher = [alice, bob].max_by(&:id)
      lower  = [alice, bob].min_by(&:id)
      raw = described_class.new(account_a: higher, account_b: lower, last_activity_at: Time.current)
      expect(raw).to_not be_valid
      expect(raw.errors[:base]).to include(/account_a_id must be less than account_b_id/)
    end

    it 'refuses invalid kind' do
      convo = described_class.mate_between!(alice, bob)
      convo.kind = 'nonsense'
      expect(convo).to_not be_valid
    end
  end

  describe '#other_account_for' do
    let(:convo) { described_class.mate_between!(alice, bob) }

    it 'returns the other account regardless of viewer' do
      expect(convo.other_account_for(alice)).to eq(bob)
      expect(convo.other_account_for(bob)).to eq(alice)
    end
  end

  describe '#unread_count_for and #mark_read!' do
    let(:convo) { described_class.mate_between!(alice, bob) }

    it 'counts messages authored by the other party after the read pointer' do
      msg1 = Fabricate(:nudges_conversation_message, conversation: convo, author_account: bob)
      Fabricate(:nudges_conversation_message, conversation: convo, author_account: bob)

      expect(convo.unread_count_for(alice)).to eq(2)

      convo.mark_read!(alice, msg1.id)
      expect(convo.reload.unread_count_for(alice)).to eq(1)
    end

    it 'does not count own messages toward unread' do
      Fabricate(:nudges_conversation_message, conversation: convo, author_account: alice)
      expect(convo.unread_count_for(alice)).to eq(0)
    end
  end

  describe '#expired?' do
    let(:convo) { described_class.mate_between!(alice, bob) }

    it 'is false when expires_at is null' do
      expect(convo.expired?).to be false
    end

    it 'is true past the expiry time' do
      convo.update!(expires_at: 1.hour.ago)
      expect(convo.expired?).to be true
    end
  end
end
