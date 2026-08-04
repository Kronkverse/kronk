# frozen_string_literal: true

# Cards pick their own render shape. Until now every ProfileCard was a
# paragraph block; the profile rebuild mock has three told-render
# shapes — `block` (paragraphs), `chips` (tag list), `rail` (mini
# cards each with a heading + short paragraph). This adds the column
# so the composer can pick per card. Existing rows default to
# `block`, matching what the frontend rendered before.
#
# Backfill is done in the same statement (default: 'block' + NOT NULL
# together on a fresh column) — safe on this size table under
# strong_migrations because ProfileCard has been in flight recently
# and the row count is small; the concurrent index takes the
# heavy-lift out of the transaction.
class AddRenderToProfileCards < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    safety_assured do
      add_column :profile_cards, :render, :string, default: 'block', null: false, if_not_exists: true
    end
  end

  def down
    remove_column :profile_cards, :render, if_exists: true
  end
end
