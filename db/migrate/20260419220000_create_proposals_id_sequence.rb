# frozen_string_literal: true

# The proposals table uses timestamp_id('proposals') as its id default (see
# CreateProposals 20260412000001). timestamp_id() internally calls
# nextval('<table>_id_seq'), so the sequence must exist even though the
# table itself does not use bigserial. The original migration didn't create
# it; this backfills it. Wrapped in safety_assured because strong_migrations
# cannot introspect raw SQL — the statements here (IF NOT EXISTS) are idempotent
# and safe regardless of table state.
class CreateProposalsIdSequence < ActiveRecord::Migration[8.0]
  def up
    safety_assured { execute 'CREATE SEQUENCE IF NOT EXISTS proposals_id_seq' }
  end

  def down
    safety_assured { execute 'DROP SEQUENCE IF EXISTS proposals_id_seq' }
  end
end
