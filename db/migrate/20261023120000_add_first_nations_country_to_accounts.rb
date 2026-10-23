# frozen_string_literal: true

# The First Nations Country someone says they live on, shown under their bio
# (docs/spaces/profile.md, Country). A name, not a place: nothing about where
# they are is stored with it.
class AddFirstNationsCountryToAccounts < ActiveRecord::Migration[8.0]
  def change
    add_column :accounts, :first_nations_country, :string
  end
end
