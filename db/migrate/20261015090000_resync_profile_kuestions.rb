# frozen_string_literal: true

# Profile Kuestions trimmed to three (Tal, 2026-10-15): birthday, "What's
# your art?" and "What are three things you think about most?", asked by
# @tal; the rest are retired in config/kuestions_profile_seeds.yml. Safe to
# re-run; `Kuestions::ProfileSeeds.sync!` matches on seed_key.
class ResyncProfileKuestions < ActiveRecord::Migration[8.0]
  def up
    Kuestions::ProfileSeeds.sync!
  end

  def down
    # Seeded Kuestions may have answers by now; leave them.
  end
end
