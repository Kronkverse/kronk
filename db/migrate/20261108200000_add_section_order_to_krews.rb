# frozen_string_literal: true

# The order a Krew's sections run down its page, as its members arrange
# it in Settings (Tal, 2026-11-08). Empty means the default order.
class AddSectionOrderToKrews < ActiveRecord::Migration[8.1]
  def change
    add_column :krews, :section_order, :string, array: true, default: [], null: false
  end
end
