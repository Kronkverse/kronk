# frozen_string_literal: true

# What kind of To do a checklist entry is: to do, pay or book
# (docs/spaces/freethedream.md, The checklist).
class AddTaskToFreethedreamItems < ActiveRecord::Migration[8.1]
  def change
    add_column :freethedream_items, :task, :integer, default: 0, null: false
  end
end
