# frozen_string_literal: true

# An event's schedule (docs/spaces/kalendar.md, Schedule): what happens
# when, one line each, over one day or several. Times are the event's own
# wall clock, minutes from midnight, so a 10:00 start reads 10:00 to
# everyone whatever their time zone.
class CreateEventScheduleLines < ActiveRecord::Migration[8.0]
  def change
    create_table :event_schedule_lines do |t|
      t.references :event, null: false, foreign_key: { on_delete: :cascade }, index: true
      t.date :day, null: false
      t.integer :start_minute, null: false
      t.integer :end_minute
      t.string :title, null: false, default: ''
      t.string :note, null: false, default: ''
      t.references :created_by_account, foreign_key: { to_table: :accounts, on_delete: :nullify }, index: false
      t.timestamps
    end
  end
end
