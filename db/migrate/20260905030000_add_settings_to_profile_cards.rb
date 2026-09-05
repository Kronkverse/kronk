# frozen_string_literal: true

# Per-tile options for a profile card. `profile_sections` has carried a
# `settings` jsonb since it was created; cards never needed one, because a card
# was only ever a body and a render shape.
#
# The tile board changes that: a tile carries a size the owner chose
# (docs/spaces/profile.md, "the tile board" — `settings.size` is `s`/`m`/`l`/
# `xl`). Adding the same jsonb the sections table already has keeps the two
# halves of the board symmetrical, and leaves room for the next per-tile option
# without another migration.
class AddSettingsToProfileCards < ActiveRecord::Migration[8.0]
  def change
    add_column :profile_cards, :settings, :jsonb, null: false, default: {}
  end
end
