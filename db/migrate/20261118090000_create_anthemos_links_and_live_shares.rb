# frozen_string_literal: true

# Live location from Anthemos (docs/spaces/map.md, Live location). A link is
# an Anthemos phone tied to an account by the public half of a key the phone
# keeps; a live share is that phone's signed permission for named Mates to
# see where it is until a set time. The point itself is never stored here:
# it sits in Redis only until the share ends.
class CreateAnthemosLinksAndLiveShares < ActiveRecord::Migration[8.1]
  def change
    create_table :anthemos_links do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.string :device_name, null: false
      t.text :public_key, null: false
      t.datetime :last_used_at
      t.timestamps
    end

    create_table :live_shares do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.references :anthemos_link, null: false, foreign_key: { on_delete: :cascade }
      t.bigint :recipient_account_ids, array: true, null: false, default: []
      t.datetime :expires_at, null: false
      t.timestamps
      t.index :recipient_account_ids, using: :gin
    end
  end
end
