# frozen_string_literal: true

# A Kuestion asked in a Krew or a projekt belongs there (Tal's proposal
# "Kuestions", 2026-11-08): only the Krew's members, or whoever can see the
# projekt, see it and answer it. Without a home a Kuestion is everyone's, as
# before. The Kuestion goes with its home, so it can never fall back to being
# everyone's.
class AddHomesToQuestions < ActiveRecord::Migration[8.0]
  def change
    # Small table (a few hundred Kuestions).
    safety_assured do
      add_reference :questions, :krew, foreign_key: { on_delete: :cascade }, index: { where: 'krew_id IS NOT NULL' }
      add_reference :questions, :freethedream_project,
                    foreign_key: { to_table: :freethedream_projects, on_delete: :cascade },
                    index: { where: 'freethedream_project_id IS NOT NULL' }
    end
  end
end
