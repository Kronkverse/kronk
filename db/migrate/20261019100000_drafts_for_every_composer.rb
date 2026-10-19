# frozen_string_literal: true

# One drafts table for every composer (docs/decisions.md, 2026-10-19).
# `drafts` was the post composer's single rolling draft and `album_drafts`
# the album composer's own, the same shape twice. Each row now says which
# composer it belongs to (korner + kind) and, optionally, what it hangs off
# (context: a reply, a Krew, a profile). An account may keep many per
# composer, so the one-per-account index goes.
#
# Album drafts are copied in. Their table stays until the composers have
# moved over; a later migration drops it.
class DraftsForEveryComposer < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      change_table :drafts, bulk: true do |t|
        t.string :korner, null: false, default: 'feed'
        t.string :kind, null: false, default: 'post'
        t.string :context
        t.integer :version, null: false, default: 1
      end

      remove_index :drafts, :account_id, unique: true
      add_index :drafts, [:account_id, :korner, :kind, :updated_at], name: 'index_drafts_on_composer'

      execute <<~SQL.squish
        INSERT INTO drafts (account_id, korner, kind, params, media_attachment_ids, created_at, updated_at)
        SELECT account_id, 'albutts', 'album', params, media_attachment_ids, created_at, updated_at
        FROM album_drafts
      SQL
    end
  end

  def down
    safety_assured do
      execute "DELETE FROM drafts WHERE NOT (korner = 'feed' AND kind = 'post' AND context IS NULL)"
      # Keep the newest feed draft per account, as the unique index needs.
      execute <<~SQL.squish
        DELETE FROM drafts d USING drafts newer
        WHERE d.account_id = newer.account_id AND d.updated_at < newer.updated_at
      SQL
      remove_index :drafts, name: 'index_drafts_on_composer'
      add_index :drafts, :account_id, unique: true
      change_table :drafts, bulk: true do |t|
        t.remove :korner, :kind, :context, :version
      end
    end
  end
end
