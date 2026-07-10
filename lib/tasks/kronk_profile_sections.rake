# frozen_string_literal: true

# Backfill baseline timeline sections for existing local accounts that
# don't have any ProfileSection rows yet. Idempotent — safe to rerun.
#
# Usage:
#   RAILS_ENV=production bundle exec rake kronk:profile_sections:backfill

namespace :kronk do
  namespace :profile_sections do
    desc 'Seed a baseline timeline section for every local account that lacks one'
    task backfill: :environment do
      seeded = 0
      Account.where(domain: nil).find_each do |account|
        next if account.profile_sections.exists?

        account.profile_sections.create!(section_type: 'timeline', position: 0)
        seeded += 1
      end
      puts "Seeded timeline sections for #{seeded} local account(s)."
    end
  end
end
