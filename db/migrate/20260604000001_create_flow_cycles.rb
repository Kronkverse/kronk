# frozen_string_literal: true

class CreateFlowCycles < ActiveRecord::Migration[7.2]
  def change
    create_table :flow_cycles do |t|
      t.belongs_to :account, null: false, foreign_key: true
      t.date :started_on, null: false
      t.date :ended_on
      t.integer :cycle_length
      t.text :notes

      t.timestamps
    end

    add_index :flow_cycles, [:account_id, :started_on]
  end
end
