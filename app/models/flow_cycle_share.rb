# frozen_string_literal: true

class FlowCycleShare < ApplicationRecord
  belongs_to :flow_cycle
  belongs_to :account

  validates :account_id, uniqueness: { scope: :flow_cycle_id }
end
