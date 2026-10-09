# frozen_string_literal: true

# Wachumissing (Kommons #117396143164043201, #116512978534279538): a
# listing is either something on offer (what Wachuneed has always held)
# or something wanted — a "looking for" post others can answer.
#
# A constant default on a new column is metadata-only on Postgres 11+, so
# every existing row reads as `offer` without a rewrite. The index is
# built concurrently (strong_migrations), same pattern as
# AddClaimToProposals.
class AddKindToListings < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_column :listings, :kind, :string, default: 'offer', null: false, if_not_exists: true
    add_index :listings, :kind, algorithm: :concurrently, if_not_exists: true
  end

  def down
    remove_index :listings, :kind, algorithm: :concurrently, if_exists: true
    remove_column :listings, :kind, if_exists: true
  end
end
