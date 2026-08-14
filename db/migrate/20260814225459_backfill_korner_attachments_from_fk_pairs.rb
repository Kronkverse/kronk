# frozen_string_literal: true

# Backfill the two existing FK pairs into `korner_attachments`
# (docs/kronk_korner_attachments.md §5 Phase 3):
#
#   albums.event_id     → (source: kalendar, target: albutts, kind: spawn)
#   booth_sets.event_id → (source: kalendar, target: booth,   kind: link)
#
# The FK columns stay in place as a passive mirror for one release
# cycle. A follow-up PR drops them once every reader (backend + API
# consumers) has migrated to `KornerAttachment` as the authoritative
# link. Rollback simply deletes the backfilled rows — the FK data is
# untouched so nothing is lost.
#
# ON CONFLICT DO NOTHING because the unique index on
# (source_slug, source_id, target_slug, target_id, kind) already
# protects against re-running the backfill (idempotent).
class BackfillKornerAttachmentsFromFkPairs < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      execute(<<~SQL.squish)
        INSERT INTO korner_attachments
          (source_slug, source_id, target_slug, target_id, kind,
           created_by_account_id, created_at, updated_at)
        SELECT 'kalendar', a.event_id, 'albutts', a.id, 'spawn',
               a.owner_id, NOW(), NOW()
        FROM albums a
        INNER JOIN events e ON e.id = a.event_id
        WHERE a.event_id IS NOT NULL
        ON CONFLICT DO NOTHING
      SQL

      execute(<<~SQL.squish)
        INSERT INTO korner_attachments
          (source_slug, source_id, target_slug, target_id, kind,
           created_by_account_id, created_at, updated_at)
        SELECT 'kalendar', bs.event_id, 'booth', bs.id, 'link',
               bs.account_id, NOW(), NOW()
        FROM booth_sets bs
        INNER JOIN events e ON e.id = bs.event_id
        WHERE bs.event_id IS NOT NULL
        ON CONFLICT DO NOTHING
      SQL
    end
  end

  def down
    safety_assured do
      execute(<<~SQL.squish)
        DELETE FROM korner_attachments
        WHERE source_slug = 'kalendar'
          AND (
            (target_slug = 'albutts' AND kind = 'spawn') OR
            (target_slug = 'booth'   AND kind = 'link')
          )
      SQL
    end
  end
end
