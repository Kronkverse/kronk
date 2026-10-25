# frozen_string_literal: true

# What a set is: a mix, a live recording, a track, a podcast episode or
# spoken word (docs/spaces/booth.md, What a set is). Existing sets are
# mixes, which is what the Booth was for until now.
class AddKindToBoothSets < ActiveRecord::Migration[8.0]
  def change
    add_column :booth_sets, :kind, :string, null: false, default: 'mix'
  end
end
