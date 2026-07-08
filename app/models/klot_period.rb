# frozen_string_literal: true

# == Schema Information
#
# Table name: klot_periods
#
#  id         :bigint(8)        not null, primary key
#  account_id :bigint(8)        not null
#  started_on :date             not null
#  created_at :datetime         not null
#  updated_at :datetime         not null
#

class KlotPeriod < ApplicationRecord
  belongs_to :account

  validates :started_on, presence: true
  validates :started_on, uniqueness: { scope: :account_id }

  scope :for_account,  ->(account) { where(account: account) }
  scope :most_recent_first, -> { order(started_on: :desc) }
end
