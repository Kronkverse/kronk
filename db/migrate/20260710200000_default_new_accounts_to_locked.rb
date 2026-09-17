# frozen_string_literal: true

# Kronk's follower-approval-by-default posture (§Profile.4 of the
# rebuild). New accounts get `locked: true` unless the operator flips
# it during signup or the user unlocks in their settings. Existing
# accounts keep their current value — this only shifts the default
# for future INSERTs.
class DefaultNewAccountsToLocked < ActiveRecord::Migration[8.0]
  def up
    change_column_default :accounts, :locked, from: false, to: true
  end

  def down
    change_column_default :accounts, :locked, from: true, to: false
  end
end
