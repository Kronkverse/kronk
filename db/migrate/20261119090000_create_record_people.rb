# frozen_string_literal: true

# The people a film, kar, kronikle, art piece or listing is for, or kept
# from, on top of its reach tier and Krews (Kronk::PeopleAudience,
# decisions.md 2026-11-19). The record's own version of a post's
# `status_audience_grants` / `status_audience_exclusions`, keyed like
# `record_krews`: the korner's slug and the record's id.
class CreateRecordPeople < ActiveRecord::Migration[8.1]
  def change
    create_table :record_people do |t|
      t.string :korner_slug, null: false
      t.bigint :record_id, null: false
      t.references :account, null: false, index: false, foreign_key: { on_delete: :cascade }
      t.boolean :excluded, null: false, default: false
      t.timestamps
    end
    add_index :record_people, [:korner_slug, :record_id, :account_id], unique: true, name: 'index_record_people_on_record_and_account'
    add_index :record_people, :account_id
  end
end
