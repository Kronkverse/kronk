# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::Relationship do
  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }

  describe '.for_pair' do
    it 'finds or creates a single row for a pair regardless of order' do
      r1 = described_class.for_pair(alice.id, bob.id)
      r2 = described_class.for_pair(bob.id, alice.id)
      expect(r1).to eq(r2)
      expect(r1.account_a_id).to be < r1.account_b_id
    end

    it 'refuses same-account pairs' do
      expect { described_class.for_pair(alice.id, alice.id) }.to raise_error(ArgumentError)
    end
  end

  describe '#record_message!' do
    let(:rel) { described_class.for_pair(alice.id, bob.id) }

    it 'increments message_count and returns nil below the first threshold' do
      expect(rel.record_message!).to be_nil
      expect(rel.reload.message_count).to eq(1)
    end

    it 'returns the milestone value exactly when it is crossed' do
      # Bump the counter to just below the first milestone.
      rel.update!(message_count: 249)
      expect(rel.record_message!).to eq(250)
      expect(rel.reload.last_milestone_hit).to eq(250)
    end

    it 'does not re-fire the same milestone twice' do
      rel.update!(message_count: 249)
      rel.record_message! # crosses 250
      expect(rel.record_message!).to be_nil # 251 — same milestone
    end

    it 'walks all thresholds when jumped across' do
      # A cold-migration import that jumps count to 5000 should record
      # 4000 (the highest hit); subsequent messages carry from there.
      rel.update!(message_count: 5000, last_milestone_hit: 0)
      expect(rel.record_message!).to eq(4000)
      expect(rel.reload.last_milestone_hit).to eq(4000)
    end
  end
end
