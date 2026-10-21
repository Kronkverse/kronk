# frozen_string_literal: true

# A variation added twice under one name (Colour, a choice in each) was kept
# as two. Listing.clean_variants now makes it one; this puts the listings
# saved before that through it.
class MergeRepeatedListingVariations < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  class Listing < ApplicationRecord
    self.table_name = 'listings'
  end

  def up
    Listing.where("jsonb_array_length(COALESCE(variants->'axes', '[]'::jsonb)) > 1").find_each do |listing|
      names = listing.variants['axes'].map { |axis| axis['name'].to_s.strip.downcase }
      next if names.uniq.size == names.size

      listing.update_columns(variants: ::Listing.clean_variants(listing.variants))
    end
  end

  def down; end
end
