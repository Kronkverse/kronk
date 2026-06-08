# frozen_string_literal: true

class ValidateBoothEventForeignKey < ActiveRecord::Migration[8.0]
  def change
    validate_foreign_key :booth_sets, :events
  end
end
