# frozen_string_literal: true

# Map — a short user-authored blurb on a pin ("Travelling China") plus a
# `placed_at` timestamp that's the source of truth for the on-card "Here
# since <date>". `updated_at` bumps on any save (including note edits),
# so it's the wrong signal for "how long have they been in this place";
# `placed_at` moves only when the coordinate actually changes.
class AddNoteAndPlacedAtToPresenceStates < ActiveRecord::Migration[8.0]
  def change
    add_column :presence_states, :note, :string
    add_column :presence_states, :placed_at, :datetime
  end
end
