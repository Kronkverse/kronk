# frozen_string_literal: true

# rubocop:disable I18n/RailsI18n/DecorateString -- rake task strings + seed data, no localization

# mARTketplace seed data — inserts a handful of Listing records under
# specified accounts so the /hub/martketplace browse view has real
# rows to render on shadow.
#
# Idempotent: skips a listing when a row with the same (account, title)
# already exists. Safe to re-run.
#
# Usage (on shadow):
#
#   RAILS_ENV=production bundle exec rake \
#     'kronk:martketplace:seed_mocks[tal,kronk]'
#
# The bracketed list is a comma-separated set of local usernames the
# listings should belong to; each named account gets two listings per
# category (Art / Stuff / Offerings), so 6 per account. Unknown
# usernames are skipped with a warning.
#
# When run without arguments, defaults to `[tal,kronk]` — adjust the
# argument if your local usernames differ.

namespace :kronk do
  namespace :martketplace do
    desc 'Seed mock mARTketplace listings for the named local accounts'
    task :seed_mocks, [:usernames] => :environment do |_task, args|
      usernames = (args[:usernames] || 'tal,kronk').split(',').map(&:strip).reject(&:empty?)

      abort "No usernames given. Usage: rake 'kronk:martketplace:seed_mocks[tal,kronk]'" if usernames.empty?

      # Two listings per category — one seller-tone (creation/goods) and
      # one utility-tone (goods/service) so the browse page has a
      # visible mix. The `by_index` keeps them stable across accounts:
      # the first-listed account gets set A, the second set B, etc.
      per_account_sets = [
        [
          { category: 'creation', title: 'Handwoven wall hanging — wool + linen', description: 'Naturally dyed, roughly 60×90cm. One-off; message if interested.', price_cents: 12_000, price_currency: 'AUD', location: 'Brighton, UK' },
          { category: 'creation', title: 'Small-batch zine — 24 pages, riso print',   description: 'Field notes from a month of morning walks. Limited run of 40.',      price_cents: 800,    price_currency: 'AUD', location: 'By post, UK' },
          { category: 'goods',    title: 'Sourdough starter (Bristol, active)',       description: 'Rye + wheat, bakes at 3-day cadence. Free — bring a jar.',           price_cents: nil,    price_currency: nil,   location: 'Bristol, UK' },
          { category: 'goods',    title: 'IKEA MALM 3-drawer, oak veneer',             description: 'Moving in a month. Well-loved. £30 or a trade.',                    price_cents: 3_000,  price_currency: 'AUD', location: 'Manchester, UK' },
          { category: 'service',  title: 'Guitar lessons — beginner-friendly',         description: 'Weekly, one hour. In person or online. First lesson free.', price_cents: 2_500, price_currency: 'AUD', location: 'London, UK' },
          { category: 'service',  title: 'Garden day — planting + light landscaping',  description: 'One full day, tools included. Ideal for spring beds.',              price_cents: 8_000,  price_currency: 'AUD', location: 'Devon, UK' },
        ],
        [
          { category: 'creation', title: 'Ceramic mug set — four pieces, thrown by hand', description: 'Speckled stone glaze, dishwasher-safe. Selling as a set.',       price_cents: 6_500,  price_currency: 'AUD', location: 'Sheffield, UK' },
          { category: 'creation', title: 'Screen-printed tote (natural cotton)',          description: 'Two-colour print, edition of 25. Message for design preview.', price_cents: 1_800, price_currency: 'AUD', location: 'By post, UK' },
          { category: 'goods',    title: 'Cast-iron skillet — well-seasoned',             description: 'Been with me a decade. Passing it on. Free to a good kitchen.', price_cents: nil, price_currency: nil, location: 'Edinburgh, UK' },
          { category: 'goods',    title: 'Bike trailer, single-child',                    description: 'Kids outgrew it. Folds flat. £45 or best trade.', price_cents: 4_500, price_currency: 'AUD', location: 'Cambridge, UK' },
          { category: 'service',  title: 'Website audit — accessibility + SEO',           description: 'Two-hour deep dive + a written report. Small businesses only.', price_cents: 12_000, price_currency: 'AUD', location: 'Remote' },
          { category: 'service',  title: 'Bread-baking workshop (afternoon, 3 hrs)',      description: 'Cover a full sourdough loaf plus focaccia. Ingredients inc.',   price_cents: 4_500,  price_currency: 'AUD', location: 'Bristol, UK' },
        ],
      ]

      total_inserted = 0
      total_skipped  = 0

      usernames.each_with_index do |username, idx|
        account = Account.find_by(username: username, domain: nil)
        unless account
          warn "  skipping '#{username}' — no local account with that username"
          next
        end

        set = per_account_sets[idx % per_account_sets.length]
        puts "→ #{username} (account_id=#{account.id})"

        set.each do |attrs|
          existing = Listing.exists?(account_id: account.id, title: attrs[:title])
          if existing
            total_skipped += 1
            puts "    · skip (exists): #{attrs[:title]}"
            next
          end

          Listing.create!(attrs.merge(account: account, state: 'live'))
          total_inserted += 1
          puts "    ✓ create: [#{attrs[:category]}] #{attrs[:title]}"
        end
      end

      puts
      puts "Done. #{total_inserted} listing(s) inserted, #{total_skipped} skipped as duplicates."
    end
  end
end

# rubocop:enable I18n/RailsI18n/DecorateString
