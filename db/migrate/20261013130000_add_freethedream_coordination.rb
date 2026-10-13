# frozen_string_literal: true

# FreeTheDream for in-person events (docs/spaces/freethedream.md): units on
# what's needed ("5 kg rice"), a date and place for an event, threaded talk
# that can be resolved, and an updates feed of who's bringing what.
class AddFreethedreamCoordination < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_column :freethedream_items, :unit, :string, null: false, default: ''

    add_column :freethedream_projects, :location, :string, null: false, default: ''
    add_column :freethedream_projects, :starts_on, :date

    # A reply sits under the comment it answers; a thread (a comment with no
    # parent) can be marked resolved and folds away.
    add_column :freethedream_comments, :parent_id, :bigint
    add_column :freethedream_comments, :resolved_at, :datetime
    add_column :freethedream_comments, :resolved_by_id, :bigint
    add_index :freethedream_comments, :parent_id, algorithm: :concurrently

    # One line per thing that happened: a section added, something needed,
    # someone bringing or claiming.
    create_table :freethedream_activities do |t|
      t.references :root, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.references :project, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.references :account, foreign_key: { on_delete: :nullify }
      t.string :verb, null: false
      t.bigint :item_id
      t.jsonb :data, null: false, default: {}
      t.timestamps
    end
  end
end
