# frozen_string_literal: true

# Who is told a set is live: the reach the host picks when going live, as for
# a post (decisions.md, 2026-10-26). Sets from before keep telling everyone
# tuned in to the Booth, which is what they did.
class AddVisibilityToBoothLives < ActiveRecord::Migration[8.1]
  def change
    add_column :booth_lives, :visibility, :integer, null: false, default: 0
  end
end
