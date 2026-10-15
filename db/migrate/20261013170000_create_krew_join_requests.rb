# frozen_string_literal: true

# Asking to join a Krew (Kommons proposal "Join/ Invite users to krews
# button", Tal 2026-10-13). A Krew with access `approval` is listed, and
# anyone can ask to join it; any member lets them in. A row is a request
# still waiting: accepting or declining removes it, so nothing is kept about
# who was turned away.
class CreateKrewJoinRequests < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    create_table :krew_join_requests, if_not_exists: true do |t|
      t.references :krew, null: false, foreign_key: { on_delete: :cascade }
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end

    add_index :krew_join_requests, [:krew_id, :account_id], unique: true, algorithm: :concurrently, if_not_exists: true
  end

  def down
    drop_table :krew_join_requests, if_exists: true
  end
end
