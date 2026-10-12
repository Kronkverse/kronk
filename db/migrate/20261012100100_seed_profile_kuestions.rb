# frozen_string_literal: true

# Loads the Kronk-written profile Kuestions (config/kuestions_profile_seeds.yml).
# Safe to re-run; `Kuestions::ProfileSeeds.sync!` matches on seed_key.
class SeedProfileKuestions < ActiveRecord::Migration[8.0]
  def up
    Question.reset_column_information
    Kuestions::ProfileSeeds.sync!
  end

  def down
    # Seeded Kuestions may have answers by now; leave them.
  end
end
