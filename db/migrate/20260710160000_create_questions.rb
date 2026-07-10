# frozen_string_literal: true

# Kuestions v2 — dedicated Question model, no longer Status-polymorphic
# via post_type. The rebuild delta rollup calls this out as a real
# rework because the answer-before-view feature can't be enforced when
# answers are just reply Statuses.
#
# The Status linkage lives on Question via §5.5's canonical `status_id`;
# the row on `statuses` is what appears in the feed.
class CreateQuestions < ActiveRecord::Migration[8.0]
  def change
    create_table :questions do |t|
      t.string     :title, null: false, limit: 240
      t.text       :prompt
      t.references :created_by_account, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.bigint     :status_id
      t.boolean    :locked, default: false, null: false
      t.datetime   :archived_at

      t.timestamps
    end

    add_index :questions, :status_id, unique: true, where: 'status_id IS NOT NULL'
    add_index :questions, :locked, where: 'locked = true'
    add_index :questions, :archived_at, where: 'archived_at IS NOT NULL'
  end
end
