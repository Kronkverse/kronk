# frozen_string_literal: true

# Who made a Booth set besides the person who uploaded it (Tal 2026-10-12,
# Kommons proposal "Artists Grouping"). A row is either a Kronk account the
# uploader tagged, unverified until that person confirms it, or a plain name
# for someone who is not on Kronk. The uploader is always an artist and has
# no row.
class CreateBoothSetArtists < ActiveRecord::Migration[8.0]
  def change
    create_table :booth_set_artists do |t|
      t.references :booth_set, null: false, foreign_key: { on_delete: :cascade }
      t.references :account, null: true, foreign_key: { on_delete: :cascade }
      t.string :name
      t.boolean :verified, null: false, default: false
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    add_index :booth_set_artists, [:booth_set_id, :account_id], unique: true, where: 'account_id IS NOT NULL'
  end
end
