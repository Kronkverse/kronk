# frozen_string_literal: true

# FreeTheDream's shared map (docs/spaces/freethedream.md, "Making it
# shared"). The page keeps its state as JSON documents of two kinds, each
# replaced whole on save:
#
#   member/<account id> — written only by that account: projects they
#                         suggested, requests to run one, their edits, logos
#   map/<doc id>        — admin-only: approved projects, review decisions,
#                         who runs what, admin edits and logos
#
# One table, keyed by (kind, key). The page validates and truncates every
# field it reads; the server's job is who may write what, and how much.
class CreateFreethedreamDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :freethedream_documents do |t|
      t.string :kind, null: false
      t.string :key, null: false
      t.jsonb :data, null: false, default: {}
      t.bigint :updated_by_account_id
      t.timestamps
    end
    add_index :freethedream_documents, [:kind, :key], unique: true
  end
end
