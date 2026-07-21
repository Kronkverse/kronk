# frozen_string_literal: true

# One row per (group, account) pair. `role` is 'seeder' or 'member';
# seeders are recognition of who planted the group, not owners.
class GroupMembership < ApplicationRecord
  ROLES = %w(seeder member).freeze

  belongs_to :group
  belongs_to :account

  validates :role, inclusion: { in: ROLES }
  validates :account_id, uniqueness: { scope: :group_id }

  before_validation :ensure_joined_at
  after_commit :publish_groups_member_joined, on: :create

  private

  def ensure_joined_at
    self.joined_at ||= Time.current
  end

  # groups.member.joined — a Kronker joined a group; Nudges routes to
  # the Krew conversation for the group (creates it if needed), adds
  # the joining account to the memberships, and drops a `joined`
  # event onto the stream. No Mates gate — the target is the group
  # conversation, which the joiner is now inside.
  def publish_groups_member_joined
    Kronk::KornerEvents.publish(
      'groups.member.joined',
      actor_account_id: account_id,
      group_id: group_id
    )
  end
end
