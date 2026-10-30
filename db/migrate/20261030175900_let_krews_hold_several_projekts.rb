# frozen_string_literal: true

# A Krew holds several projekts now (Tal, 2026-10-30), so a projekt's Krew
# no longer has to be its alone.
class LetKrewsHoldSeveralProjekts < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    remove_index :freethedream_projects, :krew_id, unique: true, algorithm: :concurrently
    add_index :freethedream_projects, :krew_id, algorithm: :concurrently
  end

  def down
    remove_index :freethedream_projects, :krew_id, algorithm: :concurrently
    add_index :freethedream_projects, :krew_id, unique: true, algorithm: :concurrently
  end
end
