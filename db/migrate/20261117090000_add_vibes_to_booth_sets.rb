# frozen_string_literal: true

# A set's vibes, beside its genres: Acoustic, Beats, Poetry or Organic
# (docs/spaces/booth.md, Vibes; Tal's Kommons proposal "Booth Revamp").
class AddVibesToBoothSets < ActiveRecord::Migration[8.0]
  def change
    add_column :booth_sets, :vibes, :string, array: true, default: [], null: false
  end
end
