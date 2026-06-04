# frozen_string_literal: true

class ValidateExtendNudges < ActiveRecord::Migration[8.0]
  def change
    validate_foreign_key :nudge_messages, :notifications
    validate_foreign_key :nudge_messages, :media_attachments
    validate_foreign_key :nudge_reactions, :notifications
    validate_foreign_key :nudge_reactions, :accounts
  end
end
