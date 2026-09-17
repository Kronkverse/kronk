# frozen_string_literal: true

# One-toggle-per-notification-type push preferences (spec §K.3.2). The
# single `push_enabled` boolean stays as a coarse master switch, but
# the manifest declares one notification type per emit and users
# control each independently via `push_preferences` (jsonb keyed by
# notification type name).
class AddPushPreferencesToUserKornerSettings < ActiveRecord::Migration[8.0]
  def change
    add_column :user_korner_settings, :push_preferences, :jsonb, null: false, default: {}
  end
end
