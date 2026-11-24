# frozen_string_literal: true

# Lessons (docs/spaces/wachuneed.md, Lessons): what a lesson teaches with,
# kept apart from its photos so nothing that shows a listing's photos (the
# card, the feed, a request's cover) can show it. The text and how to pay
# the seller are columns on the listing.
class CreateListingLessonMedia < ActiveRecord::Migration[8.1]
  def change
    create_table :listing_lesson_media do |t|
      t.references :listing, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :media_attachment, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.integer :position, null: false, default: 0
      t.timestamps
    end
    add_index :listing_lesson_media, [:listing_id, :position]

    add_column :listings, :lesson_body, :text
    add_column :listings, :pay_details, :text
  end
end
