# frozen_string_literal: true

# One row per (krew, account) pair. `role` is 'seeder' or 'member';
# seeders are recognition of who planted the krew, not owners.
class KrewMembership < ApplicationRecord
  ROLES = %w(seeder member).freeze

  belongs_to :krew
  belongs_to :account

  validates :role, inclusion: { in: ROLES }
  validates :account_id, uniqueness: { scope: :krew_id }

  before_validation :ensure_joined_at
  after_commit :publish_krews_member_joined, on: :create
  after_commit :publish_krews_member_left,   on: :destroy

  private

  def ensure_joined_at
    self.joined_at ||= Time.current
  end

  # krews.member.joined — a Kronker joined a krew; Nudges routes to
  # the Krew conversation for the krew (creates it if needed), adds
  # the joining account to the memberships, and drops a `joined`
  # event onto the stream. No Mates gate — the target is the krew
  # conversation, which the joiner is now inside.
  def publish_krews_member_joined
    Kronk::KornerEvents.publish(
      'krews.member.joined',
      actor_account_id: account_id,
      krew_id: krew_id
    )
  end

  # krews.member.left — the inverse. Fires whether the account left
  # via the krew's own leave endpoint or via the Nudges Krew leave
  # (which destroys the KrewMembership in the same transaction). The
  # Nudges subscriber cleans up ConversationMembership idempotently.
  def publish_krews_member_left
    Kronk::KornerEvents.publish(
      'krews.member.left',
      actor_account_id: account_id,
      krew_id: krew_id
    )
  end
end
