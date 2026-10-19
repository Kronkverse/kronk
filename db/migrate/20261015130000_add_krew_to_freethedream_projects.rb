# frozen_string_literal: true

# An emergence's Krew (Tal, 2026-10-15): everyone in a FreeTheDream
# emergence is in the Krew made with it, and joining or leaving either one
# does the same in the other (docs/spaces/freethedream.md, "The Krew").
class AddKrewToFreethedreamProjects < ActiveRecord::Migration[8.0]
  def change
    # Both tables are small (FreeTheDream went live on 2026-10-13).
    safety_assured do
      add_reference :freethedream_projects, :krew, foreign_key: { on_delete: :nullify }, index: { unique: true }
    end
  end
end
