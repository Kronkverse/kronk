# frozen_string_literal: true

class CreateBoothSets < ActiveRecord::Migration[7.2]
  def change
    create_table :booth_sets do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false
      t.text :description, default: '', null: false
      t.string :artist_name, null: false
      t.string :event_name
      t.datetime :event_date
      t.string :genre
      t.integer :duration_seconds
      t.references :audio_attachment, null: true, foreign_key: { to_table: :media_attachments, on_delete: :nullify }
      t.references :cover_attachment, null: true, foreign_key: { to_table: :media_attachments, on_delete: :nullify }
      t.integer :play_count, default: 0, null: false
      t.boolean :published, default: true, null: false
      t.timestamps
    end
  end
end
