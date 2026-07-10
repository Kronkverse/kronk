# frozen_string_literal: true

# One row per (account, korner) pair the account has explicitly
# positioned in their Hub. Position is 0-indexed; absence of any rows
# for an account means "use the default order" (tune-in popularity).
class UserHubOrder < ApplicationRecord
  belongs_to :account, inverse_of: :user_hub_orders

  validates :korner_slug, presence: true
  validates :position, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :account_id, uniqueness: { scope: :korner_slug }
end
