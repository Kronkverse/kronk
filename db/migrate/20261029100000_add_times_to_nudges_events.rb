# frozen_string_literal: true

# How many times the thing a notification reports happened, when a burst
# collapsed onto it: "Sam tagged you in 3 photos" (docs/spaces/nudges.md,
# Relevance engine). One for everything else.
class AddTimesToNudgesEvents < ActiveRecord::Migration[8.0]
  def change
    add_column :nudges_events, :times, :integer, default: 1, null: false
  end
end
