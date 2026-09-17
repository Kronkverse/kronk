# frozen_string_literal: true

# Rose — one table, five columns, and a uniqueness constraint that is the
# whole rule of the feature: one rose per sender, per recipient, per Kronk
# day (a day that starts at 3am Australia/Sydney — see Rose.current_day).
#
# `sent_on` is stored rather than derived at read time so the one-a-day rule
# is enforced by the database instead of by a check the send path can race
# past, and so "today's roses" is an index lookup rather than a timestamp
# range converted through a timezone on every request.
#
# Nothing here records whether a rose was seen, and nothing counts them.
# Roses are gone at the next boundary (Rose::SweepService) and no total
# survives on either account — docs/spaces/rose.md § What survives the clear.
class CreateRoses < ActiveRecord::Migration[8.0]
  def change
    create_table :roses do |t|
      t.references :from_account,
                   null: false,
                   foreign_key: { to_table: :accounts, on_delete: :cascade },
                   index: false
      t.references :to_account,
                   null: false,
                   foreign_key: { to_table: :accounts, on_delete: :cascade },
                   index: false
      t.date :sent_on, null: false

      t.timestamps
    end

    # The rule. A second rose from the same person on the same Kronk day
    # raises RecordNotUnique, which Rose::SendService turns into a
    # already-sent-today response.
    add_index :roses,
              [:from_account_id, :to_account_id, :sent_on],
              unique: true,
              name: :index_roses_on_pair_and_day

    # The read path: everything addressed to me today, newest last (the
    # stack grows outward in arrival order).
    add_index :roses, [:to_account_id, :sent_on], name: :index_roses_on_recipient_and_day
  end
end
