# frozen_string_literal: true

# A nudge can come from no one in particular: "People are huddling" is a
# head-count, not something a person did to you (Kommons "Fomo noto").
class AllowNudgesWithoutActor < ActiveRecord::Migration[8.1]
  def change
    change_column_null :nudges_events, :actor_account_id, true
  end
end
