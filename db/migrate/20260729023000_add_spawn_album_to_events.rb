# frozen_string_literal: true

# Kalendar → Albutts spawn (docs/spaces/albutts.md §Cross-korner
# connections). A boolean flag on the event row; when set, the Albutts
# subscriber creates a companion album on `kalendar.event.created`.
# Owner = event creator; visibility public for MVP.
#
# Nullable + defaulted to false so existing rows aren't disturbed.
class AddSpawnAlbumToEvents < ActiveRecord::Migration[8.0]
  def change
    add_column :events, :spawn_album, :boolean, null: false, default: false
  end
end
