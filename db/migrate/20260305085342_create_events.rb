# frozen_string_literal: true

class CreateEvents < ActiveRecord::Migration[7.2]
  def change
    create_table :events do |t|
      t.references :status, null: true, foreign_key: { on_delete: :nullify }, index: true
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false
      t.text :description, default: '', null: false
      t.datetime :start_time, null: false
      t.datetime :end_time
      t.string :location_name
      t.string :location_url
      t.integer :event_type, default: 0, null: false
      t.string :huddle_url
      t.boolean :rsvp_enabled, default: true, null: false
      t.integer :max_attendees
      t.string :recurrence_rule
      t.references :parent_event, null: true, foreign_key: { to_table: :events, on_delete: :cascade }
      t.date :occurrence_date
      t.boolean :cancelled, default: false, null: false
      t.integer :going_count, default: 0, null: false
      t.integer :interested_count, default: 0, null: false
      t.timestamps
    end

    create_table :event_rsvps do |t|
      t.references :event, null: false, foreign_key: { on_delete: :cascade }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.integer :status, default: 0, null: false
      t.timestamps
    end

    add_index :event_rsvps, [:event_id, :account_id], unique: true

    create_table :event_invitations do |t|
      t.references :event, null: false, foreign_key: { on_delete: :cascade }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :invited_by, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.integer :status, default: 0, null: false
      t.timestamps
    end

    add_index :event_invitations, [:event_id, :account_id], unique: true
  end
end
