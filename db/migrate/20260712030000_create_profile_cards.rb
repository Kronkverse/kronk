# frozen_string_literal: true

# Per-account identity cards on /@user (About me / Interests / Values /
# Personality snapshot / etc.). Distinct from profile_sections, which
# hold *collections of statuses* (My Work) — cards hold identity content
# and don't reference posts.
#
# A card carries:
#   card_type   the well-known slug the frontend renders (e.g. 'about')
#   body        HTML body — sanitised at read
#   visibility  who can see it (everyone / kronk / connections /
#               vouched / only_me) — enforced by the serializer
#   position    order within the profile column layout
#   visible     soft-hide toggle without deleting the row
class CreateProfileCards < ActiveRecord::Migration[8.0]
  def change
    create_table :profile_cards do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string     :card_type, null: false
      t.text       :body
      t.integer    :visibility, null: false, default: 1 # kronk (local)
      t.integer    :position,   null: false, default: 0
      t.boolean    :visible,    null: false, default: true

      t.timestamps
    end

    add_index :profile_cards, [:account_id, :card_type], unique: true
    add_index :profile_cards, [:account_id, :position]
  end
end
