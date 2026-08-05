# frozen_string_literal: true

# Adds `kommunity_discoverability` to `accounts` — a Kronk-native
# knob controlling whether an account surfaces in the Kommunity
# `discover` list (docs/spaces/kommunity.md — new list surface).
#
# Three-state enum:
#   0 → everyone   default; anyone signed in can see this account in the list
#   1 → orbit      only mates-of-mates (one hop out) can see it
#   2 → nobody     hidden from the list entirely
#
# Kept SEPARATE from Mastodon's existing `accounts.discoverable`
# boolean, which governs federated search + similar-profile
# suggestions — that has to keep meaning what upstream Mastodon
# means by it. This column is Kronk-only, no federation semantics.
#
# Nullable false with default 0 so existing rows are `everyone` on
# migration (matches Mastodon's default of `discoverable: true`
# which is philosophically the same posture — open unless the user
# opts down).
#
# strong_migrations pattern: `add_column` with a non-volatile
# default is safe in modern Postgres (metadata-only, no table
# rewrite), so no `disable_ddl_transaction!` dance.
class AddKommunityDiscoverabilityToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :kommunity_discoverability, :integer, default: 0, null: false
    add_index  :accounts, :kommunity_discoverability
  end
end
