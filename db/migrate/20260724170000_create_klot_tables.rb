# frozen_string_literal: true

# Klot — cycle tracker (KRONK_TIDES brief). Three tables:
#
#   cycle_profiles — per-account settings (cycle_length + period_length).
#   cycle_logs     — the manual period log; newest row anchors the phase.
#   phase_shares   — directional allowlist. Sharer permits Viewer to see
#                    their derived phase. Revocation = destroy the row;
#                    nothing is retained about a revoked viewer.
#
# Invariants encoded in the schema:
# - CycleProfile is one-per-account: unique index on account_id.
# - PhaseShare is directional and unique per (sharer, viewer). No
#   soft-delete; nothing retained about revoked grants.
# - CycleLog has no ended_on / duration this pass — the brief holds
#   that as an open question. Just started_on for now.
# - Sharer + viewer FKs cascade-delete: if an account is destroyed,
#   both directions of its shares evaporate.
#
# Phase itself is server-derived at read time (Kronk::CyclePhase); no
# `phase` column exists. Nothing outside Klot ever touches these rows.
class CreateKlotTables < ActiveRecord::Migration[8.0]
  def change
    create_table :cycle_profiles do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.integer  :cycle_length,  null: false, default: 28
      t.integer  :period_length, null: false, default: 5
      t.timestamps
    end

    create_table :cycle_logs do |t|
      t.references :account, null: false, foreign_key: { on_delete: :cascade }
      t.date :started_on, null: false
      t.timestamps
      t.index [:account_id, :started_on], order: { started_on: :desc }, name: 'index_cycle_logs_on_account_and_started_on_desc'
    end

    create_table :phase_shares do |t|
      t.bigint :sharer_id, null: false
      t.bigint :viewer_id, null: false
      t.datetime :created_at, null: false, default: -> { 'CURRENT_TIMESTAMP' }
      t.index [:sharer_id, :viewer_id], unique: true
      t.index [:viewer_id]
    end

    add_foreign_key :phase_shares, :accounts, column: :sharer_id, on_delete: :cascade
    add_foreign_key :phase_shares, :accounts, column: :viewer_id, on_delete: :cascade
  end
end
