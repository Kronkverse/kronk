# frozen_string_literal: true

# Text overlays on a Moment — the Signal-Stories-style writing that
# sits *on* the image rather than beside it in a caption. Stored as
# JSONB so the viewer can render each overlay as a positioned DOM
# element (not baked into the pixels), which keeps the source image
# clean, makes overlays screen-readable, and leaves the door open to
# post-hoc editing / localisation.
#
# Each overlay is a hash of the shape:
#
#   { id: <uuid>, text: 'hi',
#     x: 0.2, y: 0.1, width: 0.6, size: 0.05, rotation: -10,
#     color: '#ece9f5',
#     backing: 'none' | 'dark' | 'light' | 'accent',
#     font: 'display' | 'body' | 'mono' }
#
# where x / y / width / size are normalised 0..1 fractions of the
# media box so the layout is aspect-invariant across viewer, grid
# tile, and any future preview surface. `rotation` is degrees.
#
# Default empty array. `strong_migrations` allows `add_column` +
# default on an empty table (Moments is < 24h ephemeral so the row
# count stays small either way) without `disable_ddl_transaction!` —
# but we set it defensively to match the surrounding migrations.
class AddTextOverlaysToMoments < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    safety_assured do
      add_column :moments, :text_overlays, :jsonb, default: [], null: false
    end
  end
end
