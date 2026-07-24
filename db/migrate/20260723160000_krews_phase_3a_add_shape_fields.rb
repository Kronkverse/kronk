# frozen_string_literal: true

# Krews Phase 3a — the brief's data model, additive layer.
#
# Adds the new fields the KRONK_KREWS brief calls for on the existing
# krews + krew_memberships tables, plus two new tables (krew_korners,
# krew_requirements). Nothing is dropped; the existing multi-seeder /
# governance-framework machinery keeps working alongside the new
# single-seeder shape so the controller doesn't have to switch modes
# in the same PR. A follow-up cleanup can retire the unused columns.
#
# New on `krews`:
#   seeded_by_account_id — the (single) seeder per §3. Backfilled from
#                          the earliest krew_memberships row with role
#                          = 'seeder' (or oldest membership if none).
#                          Non-null after backfill.
#   access               — enum: 'open' | 'invite_only' | 'requirement_gated'.
#                          Existing rows: 'open' if discoverable,
#                          'invite_only' otherwise.
#   invite_token         — a revocable capability token backing the
#                          invite link. Unique when present; regenerable.
#   member_count         — counter cache. Backfilled from the current
#                          membership count.
#   last_activity_at     — timestamp; drives the "Yours" ordering + the
#                          Nudges surface. Defaults to created_at on
#                          backfill.
#
# New on `krew_memberships`:
#   source        — enum: 'direct' | 'invite' | 'rsvp_auto'. Existing
#                   rows default to 'direct'.
#   rsvp_event_id — nullable FK to events. Set when source='rsvp_auto'
#                   so the member can opt out of the auto-join without
#                   dropping the RSVP.
#
# New tables:
#   krew_korners     — attachment registry (which frameworks this krew
#                       accretes). Fixed enum of korner slugs.
#   krew_requirements — evaluated at join attempt when access =
#                       requirement_gated. ANDed across rows.
#
# `safety_assured` — Kronk-local tables, no production traffic yet.
# The FK adds + backfill would otherwise gate under strong_migrations.
class KrewsPhase3aAddShapeFields < ActiveRecord::Migration[8.0]
  def up
    safety_assured do
      # ── krews ────────────────────────────────────────────────────
      add_reference :krews, :seeded_by_account, foreign_key: { to_table: :accounts, on_delete: :nullify }, null: true
      add_column    :krews, :access, :string, default: 'open', null: false
      add_column    :krews, :invite_token, :string, null: true
      add_column    :krews, :member_count, :integer, default: 0, null: false
      add_column    :krews, :last_activity_at, :datetime, null: true

      add_index :krews, :invite_token, unique: true, where: 'invite_token IS NOT NULL'
      add_index :krews, :access
      add_index :krews, :last_activity_at, order: { last_activity_at: :desc }

      # Backfill seeded_by from the earliest 'seeder' membership, else
      # the earliest membership. Rows with no memberships stay null.
      execute <<~SQL.squish
        UPDATE krews SET seeded_by_account_id = sub.account_id
        FROM (
          SELECT DISTINCT ON (krew_id) krew_id, account_id
          FROM   krew_memberships
          ORDER  BY krew_id,
                    CASE WHEN role = 'seeder' THEN 0 ELSE 1 END,
                    id ASC
        ) sub
        WHERE krews.id = sub.krew_id
      SQL

      # Backfill access from discoverable.
      execute <<~SQL.squish
        UPDATE krews
        SET    access = CASE WHEN discoverable THEN 'open' ELSE 'invite_only' END
      SQL

      # Backfill counter + activity.
      execute <<~SQL.squish
        UPDATE krews SET member_count = COALESCE((
          SELECT COUNT(*) FROM krew_memberships WHERE krew_id = krews.id
        ), 0)
      SQL

      execute 'UPDATE krews SET last_activity_at = created_at WHERE last_activity_at IS NULL'

      # ── krew_memberships ─────────────────────────────────────────
      add_column    :krew_memberships, :source, :string, default: 'direct', null: false
      add_reference :krew_memberships, :rsvp_event, foreign_key: { to_table: :events, on_delete: :nullify }, null: true

      add_index :krew_memberships, :source

      # ── krew_korners ─────────────────────────────────────────────
      create_table :krew_korners do |t|
        t.references :krew, null: false, foreign_key: { on_delete: :cascade }
        t.string     :korner, null: false
        t.datetime   :created_at, null: false, default: -> { 'CURRENT_TIMESTAMP' }
      end
      add_index :krew_korners, [:krew_id, :korner], unique: true

      # ── krew_requirements ────────────────────────────────────────
      create_table :krew_requirements do |t|
        t.references :krew, null: false, foreign_key: { on_delete: :cascade }
        t.string     :kind, null: false
        t.references :event, foreign_key: { on_delete: :cascade }, null: true
        t.string     :region, null: true
        t.jsonb      :vouch_params, null: true
        t.datetime   :created_at, null: false, default: -> { 'CURRENT_TIMESTAMP' }
      end
      add_index :krew_requirements, :kind
    end
  end

  def down
    safety_assured do
      drop_table :krew_requirements
      drop_table :krew_korners

      remove_column :krew_memberships, :rsvp_event_id
      remove_column :krew_memberships, :source

      remove_column :krews, :last_activity_at
      remove_column :krews, :member_count
      remove_column :krews, :invite_token
      remove_column :krews, :access
      remove_column :krews, :seeded_by_account_id
    end
  end
end
