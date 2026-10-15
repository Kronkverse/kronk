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
end
