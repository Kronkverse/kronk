# frozen_string_literal: true

# A Kuddle isn't owned by anyone (Tal, 2026-10-29; docs/decisions.md). Purging
# the account that started one used to delete the Kuddle by foreign key, and
# its recordings with it. Now the Kuddle stays and simply has no maker.
# Live sets are owned, so booth_lives keeps its cascade.
class LetKuddlesOutliveTheirHost < ActiveRecord::Migration[8.0]
  def up
    # A brief exclusive lock on accounts and huddle_sessions; give up rather
    # than queue the site behind a long query (the deploy can be rerun).
    safety_assured do
      execute "SET LOCAL lock_timeout = '5s'"
      change_column_null :huddle_sessions, :host_account_id, true
    end

    remove_foreign_key :huddle_sessions, column: :host_account_id
    # Not re-validated: every existing row already satisfied the old key.
    add_foreign_key :huddle_sessions, :accounts, column: :host_account_id, on_delete: :nullify, validate: false
  end

  def down
    safety_assured { execute "SET LOCAL lock_timeout = '5s'" }

    remove_foreign_key :huddle_sessions, column: :host_account_id
    add_foreign_key :huddle_sessions, :accounts, column: :host_account_id, on_delete: :cascade, validate: false
    # Fails while any Kuddle has lost its maker; those have to be dealt with
    # by hand first.
    safety_assured { change_column_null :huddle_sessions, :host_account_id, false }
  end
end
