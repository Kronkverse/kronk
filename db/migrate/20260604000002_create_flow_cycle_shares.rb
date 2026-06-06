# frozen_string_literal: true

class CreateFlowCycleShares < ActiveRecord::Migration[7.2]
  def change
    create_table :flow_cycle_shares do |t|
      t.belongs_to :flow_cycle, null: false, foreign_key: true
      t.belongs_to :account, null: false, foreign_key: true

      t.timestamps
    end

    add_index :flow_cycle_shares, [:flow_cycle_id, :account_id], unique: true
  end
end
