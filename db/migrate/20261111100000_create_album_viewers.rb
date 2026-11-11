# frozen_string_literal: true

# The people an album's owner chose to see it (docs/spaces/albutts.md, Who
# can see an album).
class CreateAlbumViewers < ActiveRecord::Migration[8.1]
  def change
    create_table :album_viewers do |t|
      t.references :album, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end
    add_index :album_viewers, [:album_id, :account_id], unique: true
  end
end
