# frozen_string_literal: true

# Moment froths — ephemeral favourites tied to a Moment. Every row
# expires with its parent Moment (destroyed via dependent: :destroy
# on the Moment model + the reaper job).
class CreateMomentFroths < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    create_table :moment_froths do |t|
      t.references :moment,  null: false, foreign_key: true
      t.references :account, null: false, foreign_key: true
      t.datetime   :created_at, null: false
    end

    add_index :moment_froths, %i(moment_id account_id), unique: true, algorithm: :concurrently
  end
end
