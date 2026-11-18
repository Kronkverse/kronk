# frozen_string_literal: true

# What a wanted ad is after (docs/spaces/wachuneed.md, Wanted ads): a
# thing, something made, a job done, or someone for a time; where it
# happens; by when (or, for someone for a time, on what day); and how many
# people it wants. Null on everything on offer and on older wanted ads.
class AddWantedDetailsToListings < ActiveRecord::Migration[8.0]
  def change
    add_column :listings, :looking_for, :string
    add_column :listings, :where_mode, :string
    add_column :listings, :due_on, :date
    add_column :listings, :spots, :integer, default: 1, null: false
  end
end
