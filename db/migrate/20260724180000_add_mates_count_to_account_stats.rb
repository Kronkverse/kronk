# frozen_string_literal: true

# Kronk — Mates. Denormalised mutual-follow counter on account_stats, so the
# profile "Mates" number is a cheap read (like followers_count) rather than a
# per-request intersection query. Maintained by Follow's create/destroy
# callbacks (a follow that completes/breaks a reciprocal pair bumps both
# accounts); existing mutual pairs are backfilled by a follow-up recount.
#
# Adding a NOT NULL column with a constant default is metadata-only on
# PostgreSQL 11+ (no table rewrite), so this is safe on a large table.
class AddMatesCountToAccountStats < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :account_stats, :mates_count, :bigint, null: false, default: 0
    end
  end
end
