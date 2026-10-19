# frozen_string_literal: true

# Asking to add photos to an album you can see but not add to
# (docs/spaces/albutts.md, Asking to add photos). One open request per
# person per album; the owner accepts (onto the roster) or declines.
class CreateAlbumContributionRequests < ActiveRecord::Migration[8.0]
  def change
    create_table :album_contribution_requests do |t|
      t.references :album, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end

    add_index :album_contribution_requests, [:album_id, :account_id], unique: true
  end
end
