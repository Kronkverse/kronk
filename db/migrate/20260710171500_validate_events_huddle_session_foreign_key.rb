# frozen_string_literal: true

# Validate the events.huddle_session_id foreign key added in the
# previous migration. Runs after so the FK add itself doesn't block
# writes; validation is fast on an empty column and non-blocking.
class ValidateEventsHuddleSessionForeignKey < ActiveRecord::Migration[8.0]
  def change
    validate_foreign_key :events, column: :huddle_session_id
  end
end
