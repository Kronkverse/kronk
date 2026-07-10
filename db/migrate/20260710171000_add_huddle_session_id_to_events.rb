# frozen_string_literal: true

# Kalendar events can optionally point at a HuddleSession — the "this
# event IS a gathering on that huddle" linkage. Peer models: neither
# owns the other; an event can exist without a huddle and vice versa.
# See §Huddle in delta rollup.
class AddHuddleSessionIdToEvents < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_reference :events, :huddle_session,
                  null: true,
                  foreign_key: false,
                  index: { algorithm: :concurrently, if_not_exists: true },
                  if_not_exists: true

    # Add FK without validating existing rows — validation runs in
    # the follow-up migration. This avoids strong_migrations' "adding
    # a foreign key blocks writes on both tables" gate.
    safety_assured do
      add_foreign_key :events, :huddle_sessions,
                      column: :huddle_session_id,
                      on_delete: :nullify,
                      validate: false
    end
  end

  def down
    remove_foreign_key :events, column: :huddle_session_id, if_exists: true
    remove_reference :events, :huddle_session, if_exists: true
  end
end
