# frozen_string_literal: true

# More is better at an event, but only for some things (Tal, 2026-10-19:
# "20+ is a general idea, not a rule! We don't need 20 gas bottles"). A
# need says whether more than its amount is welcome: 20+ plates, but 2 gas
# bottles.
class AddMoreWelcomeToFreethedreamItems < ActiveRecord::Migration[8.0]
  def change
    add_column :freethedream_items, :more_welcome, :boolean, default: false, null: false
  end
end
