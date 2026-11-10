# frozen_string_literal: true

# Projekt chats start on (docs/spaces/freethedream.md, Chat): the projekts
# made before that get theirs turned on too. Komponents have no chat.
class TurnOnFreethedreamProjectChats < ActiveRecord::Migration[8.1]
  def up
    safety_assured do
      execute <<~SQL.squish
        UPDATE freethedream_projects
        SET spaces = array_append(spaces, 'nudges')
        WHERE parent_id IS NULL AND NOT ('nudges' = ANY(spaces))
      SQL
    end
  end

  def down; end
end
