# frozen_string_literal: true

# A member keeping a Booth set to come back to. Private to them.
class BoothSetSave < ApplicationRecord
  belongs_to :account
  belongs_to :booth_set, inverse_of: :saves

  validates :booth_set_id, uniqueness: { scope: :account_id }
end
