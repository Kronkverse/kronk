# frozen_string_literal: true

# What happens in a live set besides the music (docs/spaces/booth.md, The
# crowd on screen): listeners' shoutouts, reactions and track requests, and
# the host's Now playing. One row each, with `at_seconds`, how far into the
# set it came, so the Now playing rows become the set's track list
# afterwards. Gone with the live set or the person.
class CreateBoothLiveMoments < ActiveRecord::Migration[8.0]
  def change
    create_table :booth_live_moments do |t|
      t.references :booth_live, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :kind, null: false
      t.text :body, null: false, default: ''
      t.string :artist
      t.string :title
      t.integer :at_seconds, null: false, default: 0
      t.timestamps
    end
    add_index :booth_live_moments, [:booth_live_id, :id]
  end
end
