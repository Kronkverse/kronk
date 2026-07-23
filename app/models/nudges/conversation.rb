# frozen_string_literal: true

# Nudges::Conversation — a messenger conversation. Two kinds share
# the same table:
#
# - **mate** — a 1:1 chat between two accounts. Pair stored sorted
#   (`account_a_id < account_b_id`) so there is exactly one row per
#   pair and lookups from either direction hit the same row. Read
#   state lives inline (`last_read_message_id_a` / `_b`).
# - **krew** — a group chat attached to a `Krew` (`krew_id`).
#   Membership + per-account read state live on
#   `Nudges::ConversationMembership`. One row per krew.
#
# The uniqueness invariants are enforced at the DB level (partial
# indexes on `(account_a_id, account_b_id)` where kind='mate' and on
# `krew_id` where krew_id IS NOT NULL) and at the model level here.
module Nudges
  class Conversation < ApplicationRecord
    self.table_name = 'nudges_conversations'

    KINDS = %w(mate krew).freeze
    MATE  = 'mate'
    KREW  = 'krew'

    belongs_to :account_a, class_name: 'Account', optional: true
    belongs_to :account_b, class_name: 'Account', optional: true
    belongs_to :krew, class_name: 'Krew', optional: true

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
    has_many :memberships,
             class_name: 'Nudges::ConversationMembership',
             inverse_of: :conversation,
             dependent: :destroy

    validates :kind, inclusion: { in: KINDS }
    validate  :mate_or_krew_shape

    before_validation :ensure_last_activity_at, on: :create

    scope :recent, -> { order(last_activity_at: :desc) }
    scope :active, -> { where('expires_at IS NULL OR expires_at > ?', Time.current) }
    scope :mate,   -> { where(kind: MATE) }
    scope :krew,   -> { where(kind: KREW) }

    # Union of the Mate rows this account participates in + the Krew
    # rows this account is a member of.
    scope :for_account, lambda { |account|
      mate_ids = mate.where('account_a_id = :id OR account_b_id = :id', id: account.id).select(:id)
      krew_ids = krew.joins(:memberships).where(nudges_conversation_memberships: { account_id: account.id }).select(:id)
      where(id: mate_ids).or(where(id: krew_ids))
    }

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

    # Find or create the Krew conversation for a Krew. Backfills a
    # `Nudges::ConversationMembership` for every current krew member
    # on first creation; subsequent joins land via the Phase 2c
    # `krews.member.joined` subscriber.
    def self.krew_for!(krew)
      convo = find_or_create_by!(kind: KREW, krew: krew) do |c|
        c.last_activity_at = Time.current
      end

      krew.members.find_each do |account|
        convo.memberships.find_or_create_by!(account_id: account.id) do |m|
          m.joined_at = Time.current
        end
      end
      convo
    end

    def mate?
      kind == MATE
    end

    def krew?
      kind == KREW
    end

    def other_account_for(account)
      return nil unless mate?

      account_a_id == account.id ? account_b : account_a
    end

    def unread_count_for(account)
      return 0 if muted_for?(account)

      pointer = last_read_message_id_for(account)
      scope   = messages.where.not(author_account_id: account.id)
      scope = scope.where(Nudges::ConversationMessage.arel_table[:id].gt(pointer)) if pointer
      scope.count
    end

    def muted_for?(account)
      return false if mate?

      memberships.exists?(account_id: account.id, muted: true)
    end

    def mark_read!(account, up_to_message_id)
      if mate?
        column = account_a_id == account.id ? :last_read_message_id_a : :last_read_message_id_b
        update!(column => up_to_message_id)
      else
        membership = memberships.find_by(account_id: account.id)
        membership&.update!(last_read_message_id: up_to_message_id)
      end

      Nudges::StreamPublisher.read_pointer(
        conversation: self,
        reader_account_id: account.id,
        up_to_message_id: up_to_message_id
      )
    end

    def participant?(account)
      if mate?
        account_a_id == account.id || account_b_id == account.id
      else
        memberships.exists?(account_id: account.id)
      end
    end

    def expired?
      expires_at.present? && expires_at <= Time.current
    end

    # The OTHER Mate account's last-read pointer. Powers the sent-by-me
    # "seen" indicator client-side. Null for Krew (multiple recipients,
    # different UX) and null when the other party hasn't read anything
    # yet.
    def other_last_read_message_id(viewer)
      return nil unless mate?

      account_a_id == viewer.id ? last_read_message_id_b : last_read_message_id_a
    end

    # Per-member last-read pointers for a Krew, excluding the viewer.
    # Each entry `{account_id:, last_read_message_id:}`; skips
    # unread-nothing members (nil pointer) since they contribute no
    # signal. Nil for Mate (use `other_last_read_message_id` there).
    def krew_read_pointers(viewer)
      return nil unless krew?

      memberships
        .where.not(account_id: viewer.id)
        .where.not(last_read_message_id: nil)
        .pluck(:account_id, :last_read_message_id)
        .map { |aid, mid| { account_id: aid.to_s, last_read_message_id: mid.to_s } }
    end

    private

    def last_read_message_id_for(account)
      if mate?
        account_a_id == account.id ? last_read_message_id_a : last_read_message_id_b
      else
        memberships.find_by(account_id: account.id)&.last_read_message_id
      end
    end

    # Shape gate: a mate row needs two distinct sorted accounts and no
    # krew; a krew row needs a krew and no mate accounts. This holds
    # the schema invariant at model level in addition to the DB
    # partial indexes.
    def mate_or_krew_shape
      if kind == MATE
        errors.add(:base, 'mate requires account_a and account_b') if account_a_id.blank? || account_b_id.blank?
        errors.add(:account_b_id, 'must differ from account_a') if account_a_id.present? && account_a_id == account_b_id
        errors.add(:base, 'account_a_id must be less than account_b_id') if account_a_id.present? && account_b_id.present? && account_a_id >= account_b_id
        errors.add(:krew_id, 'must be blank for mate') if krew_id.present?
      elsif kind == KREW
        errors.add(:krew_id, 'is required for krew') if krew_id.blank?
        errors.add(:base, 'krew must not carry mate accounts') if account_a_id.present? || account_b_id.present?
      end
    end

    def ensure_last_activity_at
      self.last_activity_at ||= Time.current
    end
  end
end
