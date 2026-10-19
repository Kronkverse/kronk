# frozen_string_literal: true

# When each person last looked at a project's or section's talk, so its
# Overview can say where there's something new for them
# (docs/spaces/freethedream.md, "The dashboard").
class CreateFreethedreamReads < ActiveRecord::Migration[8.0]
  def change
    create_table :freethedream_reads do |t|
      t.references :account, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.references :project, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.datetime :seen_at, null: false
      t.timestamps
      t.index [:account_id, :project_id], unique: true
    end
  end
end
