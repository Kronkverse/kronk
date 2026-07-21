# frozen_string_literal: true

# Nudges::Relationship — Mate depth counters. Persists across
# conversation expiry (a time-boxed Mate conversation may clear, but
# the pair's history counter does not).
#
# `message_count` is BOTH-DIRECTIONS combined per Tal's 2026-07-21
# decision — the milestone metric is the shared count, not a per-user
# achievement. Milestones fire once each at
# `MILESTONE_THRESHOLDS = [250, 500, 1000, 2000, 4000, 8000, 10000]`;
# `last_milestone_hit` records the highest threshold crossed so a
# milestone pin is emitted exactly once when the count reaches it.
module Nudges
  class Relationship < ApplicationRecord
    self.table_name = 'nudges_relationships'

    MILESTONE_THRESHOLDS = [250, 500, 1000, 2000, 4000, 8000, 10_000].freeze

    belongs_to :account_a, class_name: 'Account'
    belongs_to :account_b, class_name: 'Account'

    validate :accounts_are_sorted
    validate :accounts_are_distinct

    def self.for_pair(one_id, two_id)
      raise ArgumentError, 'same account' if one_id == two_id

      a_id, b_id = [one_id, two_id].sort
      find_or_create_by!(account_a_id: a_id, account_b_id: b_id)
    end

    # Increment the shared message count. If this crossing triggers a
    # new milestone, return the threshold; otherwise nil. Callers wire
    # the return value into a milestone pin.
    def record_message!
      with_lock do
        self.message_count += 1
        newly_crossed = MILESTONE_THRESHOLDS.find { |t| message_count >= t && last_milestone_hit < t }

        if newly_crossed
          self.last_milestone_hit = newly_crossed
          save!
          newly_crossed
        else
          save!
          nil
        end
      end
    end

    private

    def accounts_are_sorted
      return unless account_a_id && account_b_id

      errors.add(:base, 'account_a_id must be less than account_b_id') if account_a_id >= account_b_id
    end

    def accounts_are_distinct
      errors.add(:account_b_id, 'must differ from account_a') if account_a_id == account_b_id
    end
  end
end
