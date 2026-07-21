# frozen_string_literal: true

# Nudges::Conversation — a Mate (1:1) messenger conversation. Phase 1
# ships Mate only; the `kind` column and validation exist to make Krew
# a small follow-up rather than a schema change.
#
# The Mate pair is stored sorted (`account_a_id < account_b_id`) so
# there is exactly one row per pair and lookups from either direction
# hit the same row.
#
# Read state lives on the row (`last_read_message_id_a` / `_b`) — no
# join table — because a Mate has exactly two participants.
module Nudges
  class Conversation < ApplicationRecord
    self.table_name = 'nudges_conversations'

    KINDS = %w(mate krew).freeze
    MATE  = 'mate'
    KREW  = 'krew'

    belongs_to :account_a, class_name: 'Account'
    belongs_to :account_b, class_name: 'Account'

    has_many :messages,
             -> { order(id: :asc) },
             class_name: 'Nudges::ConversationMessage',
             foreign_key: :conversation_id,
             inverse_of: :conversation,
             dependent: :destroy
    has_many :events,
             -> { order(created_at: :asc) },
             class_name: 'Nudges::Event',
             foreign_key: :conversation_id,
             inverse_of: :conversation,
             dependent: :destroy

    validates :kind, inclusion: { in: KINDS }
    validate :accounts_are_distinct
    validate :accounts_are_sorted

    before_validation :ensure_last_activity_at, on: :create

    scope :for_account, ->(account) { where('account_a_id = :id OR account_b_id = :id', id: account.id) }
    scope :recent,      -> { order(last_activity_at: :desc) }
    scope :active,      -> { where('expires_at IS NULL OR expires_at > ?', Time.current) }

    # Find or create the mate conversation between two accounts. Order
    # of arguments doesn't matter; the row's `account_a` is always the
    # lower-id account.
    def self.mate_between!(one, two)
      raise ArgumentError, 'same account' if one.id == two.id

      a, b = [one, two].sort_by(&:id)
      find_or_create_by!(kind: MATE, account_a: a, account_b: b) do |c|
        c.last_activity_at = Time.current
      end
    end

    def other_account_for(account)
      account_a_id == account.id ? account_b : account_a
    end

    def unread_count_for(account)
      pointer = last_read_message_id_for(account)
      scope   = messages.where.not(author_account_id: account.id)
      scope = scope.where(Nudges::ConversationMessage.arel_table[:id].gt(pointer)) if pointer
      scope.count
    end

    def mark_read!(account, up_to_message_id)
      column = account_a_id == account.id ? :last_read_message_id_a : :last_read_message_id_b
      update!(column => up_to_message_id)
    end

    def expired?
      expires_at.present? && expires_at <= Time.current
    end

    private

    def last_read_message_id_for(account)
      account_a_id == account.id ? last_read_message_id_a : last_read_message_id_b
    end

    def accounts_are_distinct
      errors.add(:account_b_id, 'must differ from account_a') if account_a_id == account_b_id
    end

    # Enforce the a < b invariant so the (a, b) uniqueness index is
    # actually symmetric. Callers should use `.mate_between!` which
    # sorts for them; this is the defense-in-depth check.
    def accounts_are_sorted
      return unless account_a_id && account_b_id

      errors.add(:base, 'account_a_id must be less than account_b_id') if account_a_id >= account_b_id
    end

    def ensure_last_activity_at
      self.last_activity_at ||= Time.current
    end
  end
end
