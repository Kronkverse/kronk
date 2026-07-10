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

  private

  def ensure_joined_at
    self.joined_at ||= Time.current
  end
end
