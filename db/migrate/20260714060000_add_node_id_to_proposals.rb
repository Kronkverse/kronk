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

class AddNodeIdToProposals < ActiveRecord::Migration[7.2]
  def change
    add_column :proposals, :node_id, :string, null: true
    add_index :proposals, [:node_id, :status]
  end
end
