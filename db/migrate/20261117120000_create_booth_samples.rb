# frozen_string_literal: true

# Samples in the Booth (docs/spaces/booth.md, Samples): short loops, vocals,
# beats, one-shots and stems shared for others to make things with, grouped
# into packs if the maker likes, asked for when their terms say so, and
# credited on the sets that use them.
class CreateBoothSamples < ActiveRecord::Migration[8.1]
  def change
    create_table :booth_sample_packs do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :title, null: false
      t.text :description, null: false, default: ''
      t.references :cover_attachment, foreign_key: { to_table: :media_attachments, on_delete: :restrict }
      t.timestamps
    end

    create_table :booth_samples do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :booth_sample_pack, foreign_key: { on_delete: :cascade }
      t.integer :position, null: false, default: 0
      t.string :title, null: false
      t.string :sample_type, null: false
      t.string :musical_key
      t.integer :bpm
      t.string :genre
      t.string :vibes, array: true, null: false, default: []
      t.string :terms, null: false, default: 'free'
      t.references :audio_attachment, null: false, foreign_key: { to_table: :media_attachments, on_delete: :restrict }
      t.integer :duration_seconds, null: false
      t.timestamps
    end

    create_table :booth_sample_requests do |t|
      t.references :booth_sample, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :state, null: false, default: 'pending'
      t.timestamps
      t.index [:booth_sample_id, :account_id], unique: true
    end

    create_table :booth_set_samples do |t|
      t.references :booth_set, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :booth_sample, null: false, foreign_key: { on_delete: :cascade }
      t.integer :position, null: false, default: 0
      t.timestamps
      t.index [:booth_set_id, :booth_sample_id], unique: true
    end
  end
end
