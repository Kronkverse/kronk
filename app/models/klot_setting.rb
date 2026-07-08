# frozen_string_literal: true

# == Schema Information
#
# Table name: klot_settings
#
#  id            :bigint(8)        not null, primary key
#  account_id    :bigint(8)        not null
#  cycle_length  :integer          default(28), not null
#  period_length :integer          default(5),  not null
#  created_at    :datetime         not null
#  updated_at    :datetime         not null
#

class KlotSetting < ApplicationRecord
  DEFAULT_CYCLE_LENGTH  = 28
  DEFAULT_PERIOD_LENGTH = 5

  belongs_to :account

  validates :cycle_length,  numericality: { greater_than_or_equal_to: 18, less_than_or_equal_to: 45 }
  validates :period_length, numericality: { greater_than_or_equal_to: 1, less_than_or_equal_to: 12 }

  def self.for(account)
    find_or_create_by!(account: account)
  end
end
