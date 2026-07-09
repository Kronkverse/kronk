# frozen_string_literal: true

require_relative 'base'

module Mastodon
  module CLI
    class Korners < Base
      desc 'list', 'List every Korner declared under config/korners/ and its drift'
      long_desc <<~LONG # rubocop:disable I18n/RailsI18n/DecorateString
        Prints a table showing every manifest under config/korners/, whether it's
        enforced on this branch, and any drift the boot-time validator would
        report (missing tables, missing Status associations).

        Read alongside docs/kronk_korner_spec.md.
      LONG
      def list
        Rails.application.eager_load!
        require_relative '../../kronk/version'
        say "Korner framework (Kronk v#{::Kronk::Version})"
        say ''

        header_row = %w(slug planet enforced drift)
        rows = ::Korners.all.map do |manifest|
          drift = detect_drift(manifest)
          [
            manifest.slug,
            manifest.planet.to_s,
            manifest.enforced ? 'yes' : 'no',
            drift.any? ? drift.join('; ') : 'none',
          ]
        end
        rows = rows.sort_by(&:first)

        widths = header_row.each_with_index.map do |head, idx|
          [head.length, *rows.map { |r| r[idx].length }].max
        end

        say(header_row.each_with_index.map { |h, i| h.ljust(widths[i]) }.join('  '))
        say('-' * (widths.sum + (2 * (widths.length - 1))))
        rows.each do |row|
          say(row.each_with_index.map { |cell, i| cell.ljust(widths[i]) }.join('  '))
        end

        drifty = rows.count { |r| r[3] != 'none' }
        say ''
        say "#{rows.length} registered · #{rows.count { |r| r[2] == 'yes' }} enforced · #{drifty} with drift"
      end

      private

      def detect_drift(manifest)
        drift = []
        return drift unless manifest.enforced

        prefix = manifest.db_namespace.to_s.chomp('_')
        if prefix.present?
          tables = ActiveRecord::Base.connection.tables
          drift << "no tables match '#{manifest.db_namespace}'" unless tables.include?(prefix.pluralize) || tables.any? { |t| t.start_with?("#{prefix}_") }
        end

        assoc = manifest.status_association
        drift << "Status has no :#{assoc}" if assoc && Status.reflect_on_association(assoc).nil?

        drift
      end
    end
  end
end
