# frozen_string_literal: true

class CreateTreeNodes < ActiveRecord::Migration[8.0]
  def change
    create_table :tree_nodes do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.bigint :parent_id
      t.string :kind, null: false, limit: 16
      t.string :name, null: false, limit: 200
      t.text :description, default: '', null: false
      t.string :status, limit: 16
      t.string :priority, limit: 16
      t.text :framework
      t.jsonb :steps, default: [], null: false
      t.integer :position, default: 0, null: false
      t.timestamps
    end

    add_index :tree_nodes, :parent_id
    add_index :tree_nodes, :kind

    create_table :tree_dependencies do |t|
      t.bigint :from_node_id, null: false
      t.bigint :to_node_id, null: false
      t.string :kind, null: false, limit: 16
      t.timestamps
    end

    add_index :tree_dependencies,
              [:from_node_id, :to_node_id, :kind],
              unique: true, name: 'index_tree_deps_unique'
    add_index :tree_dependencies, :to_node_id

    create_table :tree_comments do |t|
      t.bigint :node_id, null: false
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.text :body, null: false
      t.timestamps
    end

    add_index :tree_comments, :node_id
  end
end
