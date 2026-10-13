# frozen_string_literal: true

# Someone asking to join a Krew whose access is `approval`. A row is a
# request still waiting. Any member can accept it (the account becomes a
# member and the row goes) or decline it (the row goes). Nothing is kept
# about a request once it is answered.
class KrewJoinRequest < ApplicationRecord
  belongs_to :krew
  belongs_to :account

  validates :account_id, uniqueness: { scope: :krew_id }

  scope :oldest_first, -> { order(created_at: :asc, id: :asc) }

  # Let the account in. Idempotent: someone who got in another way (an
  # invite, a second member tapping Accept) is left as they are.
  def accept!
    transaction do
      krew.krew_memberships.find_or_create_by!(account: account) do |m|
        m.role = 'member'
        m.source = 'direct'
      end
      destroy!
    end
    krew.touch_activity!
  end
end
