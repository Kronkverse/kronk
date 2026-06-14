# frozen_string_literal: true
class RenameStoryReactionsToMomentReactions < ActiveRecord::Migration[8.0]
  def change
    safety_assured { rename_table :story_reactions, :moment_reactions }
  end
end
