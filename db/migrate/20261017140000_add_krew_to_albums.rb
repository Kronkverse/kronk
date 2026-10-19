# frozen_string_literal: true

# A Krew album belongs to its Krew rather than to whoever made it
# (docs/spaces/albutts.md, Krew albums). `owner_id` stays the maker.
class AddKrewToAlbums < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :albums, :krew, null: true, index: { algorithm: :concurrently }
    # Not validated: the column is new, so every row is empty. New rows are
    # checked.
    add_foreign_key :albums, :krews, on_delete: :nullify, validate: false
  end
end
