# frozen_string_literal: true

# FreeTheDream's native mechanism (docs/spaces/freethedream.md, "The
# mechanism"): projects nested to any depth, the items inside them, who has
# joined, and each person's inventory for the synergistic audit.
#
# Owners are nullified, not cascaded, when an account goes: what someone made
# stays in the project and anyone in it can take it over.
class CreateFreethedreamProjects < ActiveRecord::Migration[8.0]
  def change
    # A project or a part. A part has a parent; root is the top-level
    # project it belongs to (null on the top-level project itself).
    create_table :freethedream_projects do |t|
      t.references :parent, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.references :root, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.references :owner, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.string :title, null: false
      t.text :description, null: false, default: ''
      t.integer :joining, null: false, default: 0
      t.date :ends_on
      t.datetime :done_at
      t.bigint :source_idea_id
      t.timestamps
    end
    add_index :freethedream_projects, :source_idea_id

    # Who has joined a top-level project, or asked to.
    create_table :freethedream_memberships do |t|
      t.references :project, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.integer :state, null: false, default: 0
      t.timestamps
    end
    add_index :freethedream_memberships, [:project_id, :account_id], unique: true

    # Live Stage depends on Power.
    create_table :freethedream_dependencies do |t|
      t.references :project, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.references :depends_on, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.timestamps
    end
    add_index :freethedream_dependencies, [:project_id, :depends_on_id], unique: true, name: 'index_freethedream_dependencies_pair'

    # A person's inventory: what they have, private to them.
    create_table :freethedream_assets do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.integer :category, null: false
      t.string :title, null: false
      t.text :note, null: false, default: ''
      t.integer :quantity, null: false, default: 1
      t.timestamps
    end

    # An inventory item shared into a top-level project.
    create_table :freethedream_shares do |t|
      t.references :asset, null: false, foreign_key: { to_table: :freethedream_assets, on_delete: :cascade }
      t.references :project, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.timestamps
    end
    add_index :freethedream_shares, [:asset_id, :project_id], unique: true

    # Ideas, needs, jobs and offers. quantity is a need's amount, a job's
    # slots or an offer's amount. An offer may be against a need, and may
    # bring an inventory item.
    create_table :freethedream_items do |t|
      t.references :root, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.references :owner, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.integer :kind, null: false
      t.integer :category
      t.string :title, null: false
      t.text :body, null: false, default: ''
      t.integer :quantity, null: false, default: 1
      t.references :need, foreign_key: { to_table: :freethedream_items, on_delete: :nullify }
      t.references :asset, foreign_key: { to_table: :freethedream_assets, on_delete: :nullify }
      t.references :source_idea, foreign_key: { to_table: :freethedream_items, on_delete: :nullify }
      t.timestamps
    end
    # Both tables were created just above and are empty, so nothing waits
    # on this.
    safety_assured { add_foreign_key :freethedream_projects, :freethedream_items, column: :source_idea_id, on_delete: :nullify }

    # Where an item shows: one part or several.
    create_table :freethedream_placements do |t|
      t.references :item, null: false, foreign_key: { to_table: :freethedream_items, on_delete: :cascade }
      t.references :project, null: false, foreign_key: { to_table: :freethedream_projects, on_delete: :cascade }
      t.timestamps
    end
    add_index :freethedream_placements, [:item_id, :project_id], unique: true

    # A slot taken on a job.
    create_table :freethedream_claims do |t|
      t.references :item, null: false, foreign_key: { to_table: :freethedream_items, on_delete: :cascade }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end
    add_index :freethedream_claims, [:item_id, :account_id], unique: true

    # A short thread on any project, part or item.
    create_table :freethedream_comments do |t|
      t.string :subject_type, null: false
      t.bigint :subject_id, null: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.text :body, null: false
      t.timestamps
    end
    add_index :freethedream_comments, [:subject_type, :subject_id]
  end
end
