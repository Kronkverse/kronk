# frozen_string_literal: true

namespace :kronk do
  desc 'Show app version and platform distribution across active users'
  task client_versions: :environment do
    cursor = '0'
    versions = Hash.new(0)
    platforms = Hash.new(0)
    total = 0

    loop do
      cursor, keys = Redis.current.scan(cursor, match: 'kronk:client:*', count: 100)
      keys.each do |key|
        raw = Redis.current.get(key)
        next if raw.nil?

        data = JSON.parse(raw)
        versions[data['version']] += 1
        platform = data['platform']&.split('/')&.first || 'unknown'
        platforms[platform] += 1
        total += 1
      end
      break if cursor == '0'
    end

    puts "\nActive Kronk clients (last 30 days): #{total}"
    puts "\nBy version:"
    versions.sort_by { |_v, c| -c }.each do |version, count|
      pct = total.positive? ? (count * 100.0 / total).round(1) : 0
      puts "  #{version.ljust(12)} #{count.to_s.rjust(4)}  (#{pct}%)"
    end
    puts "\nBy platform:"
    platforms.sort_by { |_p, c| -c }.each do |platform, count|
      pct = total.positive? ? (count * 100.0 / total).round(1) : 0
      puts "  #{platform.ljust(12)} #{count.to_s.rjust(4)}  (#{pct}%)"
    end
  end

  desc 'Seed a default Timeline profile section for local accounts that have none (2.0.0 backfill)'
  task backfill_profile_sections: :environment do
    scope = Account.local.left_joins(:profile_sections)
                   .where(profile_sections: { id: nil })
    total = scope.count
    puts "Backfilling profile sections for #{total} local accounts…"

    count = 0
    scope.find_each do |account|
      account.profile_sections.create!(section_type: 'timeline', position: 0, title: nil)
      count += 1
      print '.' if (count % 100).zero?
    end

    puts ''
    puts "Done — #{count} timeline sections created."
  end
end
