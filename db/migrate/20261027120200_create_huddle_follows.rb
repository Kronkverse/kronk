# frozen_string_literal: true

# Who follows which Kuddle (a Huddle Room; docs/spaces/huddle.md, Following
# a Kuddle). A row is a choice someone made: `following: true` is a Follow,
# `following: false` an Unfollow. Members of a Krew a Kuddle is Konnected to
# follow it without a row; their Unfollow is the `false` row, so the choice
# outlasts the Krew link. Whoever made a Kuddle follows it, so the Kuddles
# that are still open get a row for their maker.
class CreateHuddleFollows < ActiveRecord::Migration[8.0]
  def up
    create_table :huddle_follows do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :huddle_session, null: false, foreign_key: { on_delete: :cascade }
      t.boolean :following, null: false, default: true
      t.timestamps
    end
    add_index :huddle_follows, [:account_id, :huddle_session_id], unique: true

    # A new, empty table and one row per open Room.
    safety_assured do
      execute <<~SQL.squish
        INSERT INTO huddle_follows (account_id, huddle_session_id, following, created_at, updated_at)
        SELECT host_account_id, id, TRUE, NOW(), NOW()
        FROM huddle_sessions
        WHERE scope = 'room' AND retired_at IS NULL
      SQL
    end
  end

  def down
    drop_table :huddle_follows
  end
end
