# frozen_string_literal: true

class Nudge < ApplicationRecord
  belongs_to :account
  belongs_to :target_account, class_name: 'Account'

  has_one :notification, as: :activity, dependent: :destroy

  scope :between, ->(account_id_a, account_id_b) {
    where(
      '(account_id = ? AND target_account_id = ?) OR (account_id = ? AND target_account_id = ?)',
      account_id_a, account_id_b, account_id_b, account_id_a
    )
  }
end
