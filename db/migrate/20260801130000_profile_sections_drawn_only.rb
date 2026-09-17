# frozen_string_literal: true

# Profile sections become drawn-only. The told/authored side of the
# profile is already covered by `ProfileCard` (identity content —
# about / interests / values / etc.) with its own five-scope visibility
# ladder and its own API at `/api/v1/profile/cards`. `ProfileSection`
# now exclusively holds *drawn* shelves — post projections computed
# from the account's own statuses.
#
# Kind collapse:
#
#   * `timeline` rows are deleted — Timeline is a peer pillar in the
#     rebuilt profile (Profile / Timeline / Kommunity), not a shelf.
#   * `korner` rows become `drawn` with `settings.render` derived from
#     the korner slug; the client dispatches on that render string.
#   * `kategory` rows become `drawn` with `settings.render = 'chips'`
#     (a curated tag list reads best as chips).
#   * Any `text` rows (from a superseded stub) become `drawn` with
#     `settings.render = 'block'`. That's a strange state but keeps
#     the migration idempotent if a text row ever landed.
#
# Adds per-shelf visibility as an integer column mirroring
# `ProfileCard.visibility` — `everyone / kronk / connections /
# vouched / only_me`. Same default (kronk = 1) so a shelf is same-
# audience as a card unless the owner opts out.
#
# ProfileSection is a fresh table (shipped 2026-07-18, no production
# rows), so the destructive DELETE / UPDATE runs under `safety_assured`.
class ProfileSectionsDrawnOnly < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  KORNER_RENDER_MAP = {
    'albutts' => 'album',
    'booth' => 'track',
    'map' => 'trek',
    'wachuneed' => 'listing',
    'kuestions' => 'answers',
    'moments' => 'moment',
  }.freeze

  def up
    add_column :profile_sections, :visibility, :integer, default: 1, null: false, if_not_exists: true

    add_index :profile_sections, :visibility,
              algorithm: :concurrently,
              if_not_exists: true

    safety_assured do
      execute <<~SQL.squish
        DELETE FROM profile_sections WHERE section_type = 'timeline'
      SQL

      execute <<~SQL.squish
        UPDATE profile_sections
        SET section_type = 'drawn',
            settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('render', 'chips')
        WHERE section_type = 'kategory'
      SQL

      # Legacy `text` rows (from a closed stub) fold into drawn/block —
      # a rare state but keeps the migration idempotent.
      execute <<~SQL.squish
        UPDATE profile_sections
        SET section_type = 'drawn',
            settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('render', 'block')
        WHERE section_type = 'text'
      SQL

      KORNER_RENDER_MAP.each do |slug, render|
        execute <<~SQL.squish
          UPDATE profile_sections
          SET section_type = 'drawn',
              settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('render', '#{render}')
          WHERE section_type = 'korner'
            AND settings->>'korner_slug' = '#{slug}'
        SQL
      end

      execute <<~SQL.squish
        UPDATE profile_sections
        SET section_type = 'drawn',
            settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('render', 'korner')
        WHERE section_type = 'korner'
      SQL
    end
  end

  def down
    remove_index :profile_sections, :visibility, algorithm: :concurrently, if_exists: true
    remove_column :profile_sections, :visibility, if_exists: true
    # Data-shape rollback is deliberately not attempted — the pre-collapse
    # kinds are ambiguous once merged.
  end
end
