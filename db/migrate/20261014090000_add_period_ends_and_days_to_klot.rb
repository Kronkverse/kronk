# frozen_string_literal: true

# Klot: a period has an end as well as a start, and any day can carry how
# heavy the bleed was, symptoms and a note (docs/spaces/klot.md, Kommons
# "More logical and user friendly plot space").
#
#   cycle_logs.ended_on — the last day of that bleed; null while it is
#                         still going, or on logs from before this existed.
#   cycle_days          — one row per account per day, owner-only.
class AddPeriodEndsAndDaysToKlot < ActiveRecord::Migration[8.0]
  def change
    add_column :cycle_logs, :ended_on, :date

    create_table :cycle_days do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.date :day, null: false
      t.string :flow
      t.string :symptoms, array: true, null: false, default: []
      t.text :note, null: false, default: ''
      t.timestamps
      t.index [:account_id, :day], unique: true
    end
  end
end
