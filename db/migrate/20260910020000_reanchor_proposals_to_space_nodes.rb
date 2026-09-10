# frozen_string_literal: true

# Re-anchor proposals whose node no longer exists.
#
# The Kommons Directory carries one node per space a user can reach
# (docs/spaces/kommons.md, "What earns a node"). Applying that removed some
# nodes, and a proposal keyed to a removed node points at nothing: it is not
# shown on the space's page and not shown anywhere else either. It is somebody's
# writing, so it moves rather than dying.
#
#   kommons.directory  → kommons.index   Directory is a rotator face of Kommons
#   kommons.new_korner → kommons.index   was the Proposer with a query string
#   martketplace.index → wachuneed.index the pre-rename spelling (#1752) — this
#                                        one was already orphaned and invisible
#
# Every other removed node carried no proposals, checked before the removal.
#
# `node_id` is a plain string column, not a foreign key, which is why these went
# unnoticed: nothing refuses a write to a node that isn't there.
class ReanchorProposalsToSpaceNodes < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  MOVES = {
    'kommons.directory' => 'kommons.index',
    'kommons.new_korner' => 'kommons.index',
    'martketplace.index' => 'wachuneed.index',
  }.freeze

  # A bare class on the table rather than the app model: a data migration
  # outlives the model definition it was written against (see #1757/#1761,
  # where batching over a model's default scope broke every test database).
  class MigratedProposal < ApplicationRecord
    self.table_name = 'proposals'
  end

  def up
    MOVES.each do |from, to|
      MigratedProposal.where(node_id: from).in_batches(of: 1_000) do |batch|
        batch.update_all(node_id: to)
      end
    end
  end

  # Irreversible in the strict sense — once several ids point at kommons.index
  # there is no way to tell which came from where. Left as a no-op rather than
  # a raise so a rollback of a later migration isn't blocked by this one.
  def down; end
end
