# frozen_string_literal: true

class CreateProposals < ActiveRecord::Migration[8.0]
  def change
    create_table :proposals, id: :bigint, default: -> { "timestamp_id('proposals'::text)" }, force: :cascade do |t|
      t.string   :title,                 null: false
      t.text     :body,                  null: false
      t.integer  :status,                null: false, default: 0
      t.integer  :decision_type,         null: false, default: 0
      t.datetime :opens_at
      t.datetime :closes_at
      t.integer  :outcome
      t.text     :outcome_notes
      t.bigint   :created_by_account_id, null: false
      t.timestamps null: false
    end

    add_index :proposals, :status
    add_index :proposals, :created_by_account_id
    add_foreign_key :proposals, :accounts, column: :created_by_account_id, on_delete: :cascade
  end
end
