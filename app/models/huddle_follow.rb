# frozen_string_literal: true

# One person's choice about one Kuddle (a Huddle Room): `following: true`
# is a Follow, `following: false` an Unfollow. Krew members follow a
# Kuddle Konnected to their Krew without a row, so for them the `false` row
# is how they stop. Huddle::Follows works out who follows what.
class HuddleFollow < ApplicationRecord
  belongs_to :account
  belongs_to :huddle_session

  validates :account_id, uniqueness: { scope: :huddle_session_id }

  scope :following, -> { where(following: true) }
  scope :declined,  -> { where(following: false) }
end
