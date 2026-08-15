# frozen_string_literal: true

# Phase 6 backfill (docs/kronk_korner_attachments.md §5): copy every
# populated `events.huddle_session_id` into `korner_attachments` as a
# `(source: kalendar, target: huddle, kind: link)` row.
#
# Mirrors the Phase 3 backfill's shape. `events.huddle_session_id`
# stays in place as a passive mirror for one release cycle; Phase 6b
# drops it after every reader migrates. Idempotent via ON CONFLICT DO
# NOTHING against the unique endpoint quintuple.
class BackfillKornerAttachmentsFromHuddleSessionFk < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute(<<~SQL.squish)
        INSERT INTO korner_attachments
          (source_slug, source_id, target_slug, target_id, kind,
           created_by_account_id, created_at, updated_at)
        SELECT 'kalendar', e.id, 'huddle', e.huddle_session_id, 'link',
               e.account_id, NOW(), NOW()
        FROM events e
        WHERE e.huddle_session_id IS NOT NULL
        ON CONFLICT DO NOTHING
      SQL
    end
  end

  def down
    safety_assured do
      execute(<<~SQL.squish)
        DELETE FROM korner_attachments
        WHERE source_slug = 'kalendar'
          AND target_slug = 'huddle'
          AND kind = 'link'
      SQL
    end
  end
end
