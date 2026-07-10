# frozen_string_literal: true

# Photos attached to a Listing. Uses Mastodon's MediaAttachment so
# storage, image processing, and CDN paths ride the existing plumbing.
class CreateListingPhotos < ActiveRecord::Migration[8.0]
  def change
    create_table :listing_photos do |t|
      t.references :listing,          null: false, foreign_key: { on_delete: :cascade }
      t.references :media_attachment, null: false, foreign_key: { on_delete: :cascade }
      t.integer    :position, default: 0, null: false

      t.timestamps
    end

    add_index :listing_photos, [:listing_id, :position]
    add_index :listing_photos, :media_attachment_id, unique: true
  end
end
