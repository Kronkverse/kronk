# frozen_string_literal: true

# The First Nations Country someone was born on, beside the one they live on
# (docs/spaces/profile.md, Country).
class AddFirstNationsCountryBornToAccounts < ActiveRecord::Migration[8.1]
  def change
    add_column :accounts, :first_nations_country_born, :string
  end
end
