# frozen_string_literal: true

# Threshold ceremony record — one timestamp, one integer per user.
# The three vows (ownership / custodianship / trajectory) are the
# membership statement, and this is the whole record: when they were
# crossed and against which version of the wording. Deliberately not
# a per-vow row, not an audit log, not IP / user-agent — see
# KRONK_SIGNUP.md, the signup brief, which is not in the repo.
class AddThresholdsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :thresholds_agreed_at, :datetime
    add_column :users, :thresholds_version, :integer
  end
end
