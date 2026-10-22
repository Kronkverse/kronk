# frozen_string_literal: true

# Every event or album in a Krew's audience is linked to it
# (docs/decisions.md, 2026-10-22, "One way to link to a Krew"). Before,
# the audience was written on its own, by the Krew page's Link buttons and
# the composers, and only some of it had a korner attachment beside it, so
# the event or album and the Krew didn't show each other in their Attached
# blocks. This adds the missing links:
#
#   statuses_krews on an event's post → (kalendar → krew, link)
#   album_krews                       → (albutts  → krew, link)
#
# Each made by the event's or album's owner. A pair already linked either
# way is left alone, and the unique index makes a re-run a no-op. Rolling
# back leaves the rows: from here on they can't be told from links people
# made.
class BackfillKrewLinksIntoAttachments < ActiveRecord::Migration[8.1]
  def up
    safety_assured do
      execute(<<~SQL.squish)
        INSERT INTO korner_attachments
          (source_slug, source_id, target_slug, target_id, kind,
           created_by_account_id, created_at, updated_at)
        SELECT DISTINCT 'kalendar', e.id, 'krew', sk.krew_id, 'link',
               e.account_id, NOW(), NOW()
        FROM events e
        INNER JOIN statuses_krews sk ON sk.status_id = e.status_id
        INNER JOIN krews k ON k.id = sk.krew_id
        WHERE NOT EXISTS (
          SELECT 1 FROM korner_attachments ka
          WHERE ka.kind = 'link'
            AND ka.source_slug = 'krew' AND ka.source_id = sk.krew_id
            AND ka.target_slug = 'kalendar' AND ka.target_id = e.id
        )
        ON CONFLICT DO NOTHING
      SQL

      execute(<<~SQL.squish)
        INSERT INTO korner_attachments
          (source_slug, source_id, target_slug, target_id, kind,
           created_by_account_id, created_at, updated_at)
        SELECT 'albutts', ak.album_id, 'krew', ak.krew_id, 'link',
               a.owner_id, NOW(), NOW()
        FROM album_krews ak
        INNER JOIN albums a ON a.id = ak.album_id
        WHERE NOT EXISTS (
          SELECT 1 FROM korner_attachments ka
          WHERE ka.kind = 'link'
            AND ka.source_slug = 'krew' AND ka.source_id = ak.krew_id
            AND ka.target_slug = 'albutts' AND ka.target_id = ak.album_id
        )
        ON CONFLICT DO NOTHING
      SQL
    end
  end

  def down; end
end
