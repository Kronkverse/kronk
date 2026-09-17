# frozen_string_literal: true

# Moments — ephemeral photo/video posts with a fixed 24h expiry.
# Discovery locked in alpha.313 (Kommons proposal #116969974437738188).
# See docs/spaces/moments.md.
#
# A Moment is a first-class row that gets projected to a Status for
# feed presence (same pattern as Kalendar events and KosmicUpdates).
# The `expires_at` column powers the fixed-24h lifecycle; scoping via
# `active` filters `expires_at > NOW()`.
class CreateMoments < ActiveRecord::Migration[8.0]
  # Non-blocking add on a currently-empty table.
  disable_ddl_transaction!

  def change
    create_table :moments do |t|
      t.references :account,           null: false, foreign_key: true
      t.references :media_attachment,  null: false, foreign_key: true
      t.text       :caption
      t.integer    :visibility,        default: 1, null: false # 0=public, 1=mates, 2=krew
      t.references :krew,              foreign_key: true # krew_id when visibility=krew (nullable otherwise). Table renamed groups→krews in 20260723150000.
      t.datetime   :expires_at,        null: false
      t.bigint     :status_id # canonical linkage to the projected Status (§5.5)

      t.timestamps
    end

    add_index :moments, :expires_at
    add_index :moments, :status_id, unique: true, where: 'status_id IS NOT NULL', algorithm: :concurrently
  end
end
