# frozen_string_literal: true

# Ideas are gone from FreeTheDream (Tal, 2026-10-15): someone with an idea
# is its first actualiser, and it sits in Actualise for others to jump on
# board. Each idea nobody had taken on becomes an Actualise item (a job)
# with its owner on it. Ideas already taken on became a section or a job
# back then; they stay as they are and no longer show.
class TurnFreethedreamIdeasIntoActualise < ActiveRecord::Migration[8.0]
  IDEA = 0
  JOB = 2

  def up
    untaken = <<~SQL.squish
      kind = #{IDEA}
      AND NOT EXISTS (SELECT 1 FROM freethedream_projects p WHERE p.source_idea_id = freethedream_items.id)
      AND NOT EXISTS (SELECT 1 FROM freethedream_items j WHERE j.source_idea_id = freethedream_items.id)
    SQL

    # A handful of rows: FreeTheDream went live on 2026-10-13.
    safety_assured do
      execute <<~SQL.squish
        INSERT INTO freethedream_claims (item_id, account_id, created_at, updated_at)
        SELECT id, owner_id, NOW(), NOW() FROM freethedream_items
        WHERE #{untaken} AND owner_id IS NOT NULL
        ON CONFLICT DO NOTHING
      SQL
      execute "UPDATE freethedream_items SET kind = #{JOB}, quantity = 1 WHERE #{untaken}"
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
