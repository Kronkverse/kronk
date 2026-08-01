# frozen_string_literal: true

# Profile shelves v2 — collapse the four-kind enum
# (`timeline`/`korner`/`kategory`/`text`) into two: `told` (owner-authored)
# and `drawn` (computed from posts). Specific render shape moves into
# `settings.render` so a new render can land in a pure-frontend PR.
#
# Also adds per-shelf visibility matching the platform ladder
# (public/mates/krew/orbit/self_only — same integer enum Album and
# Moment use).
#
# Migration behaviour on existing rows:
#
#   * `timeline` rows are deleted — Timeline is a peer pillar in the
#     rebuilt profile (`Profile | Timeline | Kommunity`), not a shelf
#     that lives inside Profile.
#   * `text` rows (added in the closed #1063 stub) become `told` with
#     `settings.render = 'block'`.
#   * `korner` rows become `drawn` with `settings.render` derived from
#     the korner slug — the client's render dispatcher walks off this.
#   * `kategory` rows become `drawn` with `settings.render = 'chips'`
#     (a curated tag list reads best as chips in the mock).
#
# ProfileSection is a two-week-old table — no production rows. The
# migration touches shadow only, so the in-place UPDATE / DELETE is
# safe under `safety_assured` (strong_migrations otherwise blocks any
# schema-shape write).
class ProfileShelvesV2 < ActiveRecord::Migration[8.0]
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
    add_column :profile_sections, :visibility, :integer, default: 0, null: false, if_not_exists: true

    add_index :profile_sections, :visibility,
              algorithm: :concurrently,
              if_not_exists: true

    safety_assured do
      execute <<~SQL.squish
        DELETE FROM profile_sections WHERE section_type = 'timeline'
      SQL

      execute <<~SQL.squish
        UPDATE profile_sections
        SET section_type = 'told',
            settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('render', 'block')
        WHERE section_type = 'text'
      SQL

      execute <<~SQL.squish
        UPDATE profile_sections
        SET section_type = 'drawn',
            settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('render', 'chips')
        WHERE section_type = 'kategory'
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

      # Fallback for any `korner` row whose slug isn't in the map — mark
      # it drawn with a generic render so the client can still walk it.
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
    # Data-shape rollback is deliberately not attempted — the pre-v2
    # kinds are ambiguous once collapsed (no reliable way to distinguish
    # a migrated `text` from a `told` written fresh under v2).
  end
end
