# frozen_string_literal: true

# A Krew's chat is a space it Konnects, like its albums or events (Tal,
# 2026-10-31; decisions.md). Every Krew made before then had one, so each
# keeps it, shown as Konnected. Krews made from now on start without one.
class KonnectExistingKrewChats < ActiveRecord::Migration[8.0]
  # Data only: one row per Krew, no schema change.
  def up
    safety_assured do
      execute <<~SQL.squish
        INSERT INTO krew_korners (krew_id, korner, created_at)
        SELECT id, 'nudges', CURRENT_TIMESTAMP FROM krews
        ON CONFLICT (krew_id, korner) DO NOTHING
      SQL
    end
  end

  def down
    safety_assured { execute "DELETE FROM krew_korners WHERE korner = 'nudges'" }
  end
end
