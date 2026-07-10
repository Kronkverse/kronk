# frozen_string_literal: true

# Kronk::Kategories — reads the default kategory list from
# config/kategory_defaults.yaml and seeds them as curated Tag rows.
# Kategories reuse Mastodon's hashtag infrastructure (§Kategories in
# the spec) so composers, feeds, search, and profile sections all
# share one taxonomy.
#
# Idempotent: existing tags with the same name get marked curated;
# no duplicates are created.

module Kronk
  module Kategories
    DEFAULTS_PATH = Rails.root.join('config', 'kategory_defaults.yaml')

    module_function

    def defaults
      @defaults ||= load_defaults
    end

    def seed!(logger: Rails.logger)
      counts = { curated: 0, created: 0 }

      defaults.each do |name|
        tag = Tag.find_or_initialize_by(name: name)

        if tag.new_record?
          tag.curated = true
          tag.save!
          counts[:created] += 1
        elsif !tag.curated?
          tag.update!(curated: true)
          counts[:curated] += 1
        end
      end

      logger&.info("[kronk:kategories] seeded: #{counts[:created]} created, #{counts[:curated]} re-marked curated")
      counts
    end

    def reload!
      @defaults = nil
    end

    def load_defaults
      return [] unless DEFAULTS_PATH.file?

      list = YAML.safe_load_file(DEFAULTS_PATH)
      return [] unless list.is_a?(Array)

      list.filter_map { |s| s.to_s.strip.presence }.uniq
    end
  end
end
