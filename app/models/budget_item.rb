# frozen_string_literal: true

class BudgetItem < ApplicationRecord
  belongs_to :proposal

  enum :status, { unfunded: 0, funded: 1, spent: 2 }

  validates :description, presence: true
  validates :cost_estimate, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
end
