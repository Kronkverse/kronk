# frozen_string_literal: true

# Karporn — single-author korner for posting photos of cars. Two tables:
#
#   kars       — the car (title / description / year / make / model /
#                optional location lat+lng+label / owner / visibility /
#                optional feed-projection Status link).
#   kar_photos — one row per photo of the car. Multiple angles / details
#                of the same vehicle by the same author, ordered by
#                `position`. Media rides on the standard MediaAttachment
#                pipeline (owner uploads via `POST /api/v1/media`).
#
# The location is optional and stored as raw lat/lng plus a display
# label. The composer's picker is deliberately simple (browser
# geolocation + manual label) — a proper Map-korner picker is a
# follow-up.
class CreateKarporn < ActiveRecord::Migration[8.0]
  def change
    create_table :kars do |t|
      t.string  :title, null: false, limit: 240
      t.text    :description
      # Year is stored as an integer with no DB-side bound; the model
      # validates 1885..(Time.current.year + 2). 1885 is the first
      # patented automobile (Benz Patent-Motorwagen).
      t.integer :year, null: false
      t.string  :make, null: false, limit: 120
      t.string  :model, null: false, limit: 120
      # Optional location tag. Stored as coordinates for maps linking +
      # a display label so the reader / feed card can show a human name
      # ("Route 66", "Nürburgring") without a reverse-geocode round-trip.
      t.decimal :location_lat, precision: 9,  scale: 6
      t.decimal :location_lng, precision: 9,  scale: 6
      t.string  :location_label, limit: 240
      t.references :owner,
                   null: false,
                   foreign_key: { to_table: :accounts, on_delete: :cascade },
                   index: true
      t.references :cover_media_attachment,
                   null: true,
                   foreign_key: { to_table: :media_attachments, on_delete: :nullify }
      t.integer :visibility, null: false, default: 0
      t.references :status,
                   null: true,
                   foreign_key: { on_delete: :nullify },
                   index: { unique: true, where: 'status_id IS NOT NULL', name: 'index_kars_on_status_id_unique' }
      t.timestamps
    end
    add_index :kars, :visibility
    add_index :kars, [:make, :model]

    create_table :kar_photos do |t|
      t.references :kar,
                   null: false,
                   foreign_key: { on_delete: :cascade }
      t.references :media_attachment,
                   null: true,
                   foreign_key: { on_delete: :nullify }
      t.text :caption
      t.integer :position, null: false, default: 0
      t.timestamps
      t.index [:kar_id, :position], name: 'index_kar_photos_on_kar_and_position'
    end
  end
end
