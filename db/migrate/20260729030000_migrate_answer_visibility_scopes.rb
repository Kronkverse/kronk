# frozen_string_literal: true

# Retire the bespoke Kuestions Answer visibility vocabulary in favour
# of the platform-wide four-tier reach ladder
# (docs/kronk_feed_and_reach.md §2).
#
# Old scope → New scope:
#   everyone       → public
#   kronk_members  → public   (local-only distinction dropped;
#                              federation isn't user-facing anyway)
#   connections    → mates
#   vouched        → mates    (vouching model never landed; readers
#                              of vouched-scope answers were mates
#                              by fallback in the old gate)
#   only_me        → self_only
#
# Also migrates the `default_answer_visibility` value stored under
# UserSetting for the Kuestions korner from the legacy manifest
# vocabulary (public/unlisted/followers) — see the same section of
# the settings_panel comment before the collapse.
#
# Safe to re-run: guards on the current value string.
class MigrateAnswerVisibilityScopes < ActiveRecord::Migration[8.0]
  ANSWER_REMAP = {
    'everyone' => 'public',
    'kronk_members' => 'public',
    'connections' => 'mates',
    'vouched' => 'mates',
    'only_me' => 'self_only',
  }.freeze

  SETTING_REMAP = {
    'unlisted' => 'public',
    'followers' => 'mates',
  }.freeze

  def up
    safety_assured do
      ANSWER_REMAP.each do |old, fresh|
        execute(<<~SQL.squish)
          UPDATE answers
          SET    visibility_scope = '#{fresh}'
          WHERE  visibility_scope = '#{old}'
        SQL
      end

      # The Kuestions default_answer_visibility setting is NOT stored in a
      # `user_settings` table — there is none. Mastodon keeps user settings in
      # the YAML-serialised `users.settings` text column, so this UPDATE
      # targeted a relation that has never existed and aborted every migration
      # run (PG::UndefinedTable), taking the answers remap above down with it.
      #
      # Guard it so the answers remap lands and deploys unblock. The setting-
      # value remap still needs doing, but against the real store (a YAML text
      # column, not addressable by plain SQL) — tracked as a follow-up; readers
      # already fall back for the legacy value (settings_panel.tsx), so nothing
      # is user-visibly broken in the interim.
      if connection.table_exists?(:user_settings)
        SETTING_REMAP.each do |old, fresh|
          %W["#{old}" #{old}].each do |value|
            execute(<<~SQL.squish)
              UPDATE user_settings
              SET    value = '"#{fresh}"'
              WHERE  var = 'kuestions.default_answer_visibility'
                AND  value = '#{value.gsub("'", "''")}'
            SQL
          end
        end
      end
    end
  end

  def down
    # Not reversible — the collapse loses the everyone/kronk_members
    # and connections/vouched distinctions. If someone needs to roll
    # back, they can pg_restore.
    raise ActiveRecord::IrreversibleMigration
  end
end
