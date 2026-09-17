# frozen_string_literal: true

# One row per (moment, account) — an ephemeral favourite on a Moment.
# Uniqueness is enforced by the DB (see the create_moment_froths
# migration); the model also validates for cleaner errors on the
# controller side.
class MomentFroth < ApplicationRecord
  belongs_to :moment, inverse_of: :moment_froths
  belongs_to :account

  validates :account_id, uniqueness: { scope: :moment_id }
end
