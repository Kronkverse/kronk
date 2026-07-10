# frozen_string_literal: true

# Kalendar events can optionally point at a HuddleSession — the "this
# event IS a gathering on that huddle" linkage. Peer models: neither
# owns the other; an event can exist without a huddle and vice versa.
# See §Huddle in delta rollup.
class AddHuddleSessionIdToEvents < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_reference :events, :huddle_session,
                  null: true,
                  foreign_key: { on_delete: :nullify },
                  index: { algorithm: :concurrently }
  end
end
