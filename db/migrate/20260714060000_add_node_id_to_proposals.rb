# frozen_string_literal: true

# Kronk Kommons Tree — add node_id to proposals so a Kommons proposal
# can be tagged with the page-type it's about.
#
# The tag is a stable string id from Kronk::NodeRegistry (e.g.
# 'booth.index', 'profile.sections'). No FK — the target lives in
# config, not a table. Anti-drift is enforced by `bin/tootctl korners
# doctor`. Nullable because existing proposals predate the tree.
#
# Index supports the per-node count query on the tree endpoint's
# hot path (`GET /api/v1/kommons/nodes`).
#
# The index is built CONCURRENTLY (with disable_ddl_transaction!) so it
# doesn't take a write-blocking lock on `proposals` — a plain add_index is
# rejected by strong_migrations and was aborting the shadow deploy. The
# `if_not_exists` guards keep it safe to re-run after the earlier failure.

class AddNodeIdToProposals < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def change
    add_column :proposals, :node_id, :string, null: true, if_not_exists: true
    add_index :proposals, [:node_id, :status], algorithm: :concurrently, if_not_exists: true
  end
end
