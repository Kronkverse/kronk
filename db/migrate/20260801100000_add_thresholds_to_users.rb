# frozen_string_literal: true

# Threshold ceremony record — one timestamp, one integer per user.
# The three vows (ownership / custodianship / trajectory) are the
# membership statement, and this is the whole record: when they were
# crossed and against which version of the wording. Deliberately not
# a per-vow row, not an audit log, not IP / user-agent — see
# docs/spaces/signup.md and KRONK_SIGNUP.md §2.
class AddThresholdsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :thresholds_agreed_at, :datetime
    add_column :users, :thresholds_version, :integer
  end
end
