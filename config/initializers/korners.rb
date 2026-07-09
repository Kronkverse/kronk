# frozen_string_literal: true

# Korner framework — manifest registry + boot-time drift check.
#
# Loads config/korners/*.yaml and exposes each declared Korner as a
# Korners::Manifest struct. Manifests with `enforced: true` get a light
# drift check on boot: table prefix must exist, declared Status
# association must be defined. Drift is logged as a warning; boot never
# fails on manifest mismatch — the goal is to make drift visible in the
# server log, not to wedge production.
#
# Companion JS-side registry:
#   app/javascript/mastodon/components/korner_cards.tsx
#
# See docs/kronk_korner_spec.md and docs/korners/adding_a_korner.md.

require 'yaml'

module Korners
  Manifest = Struct.new(
    :slug,
    :name,
    :planet,
    :db_namespace,
    :enforced,
    :status_association,
    :status_post_type,
    keyword_init: true
  )

  class << self
    def all
      @all ||= load_manifests
    end

    def enforced
      all.select(&:enforced)
    end

    def reload!
      @all = nil
    end

    private

    def load_manifests
      dir = Rails.root.join('config', 'korners')
      return [] unless dir.directory?

      dir.glob('*.yaml').filter_map { |path| parse_manifest(path) }
    end

    def parse_manifest(path)
      yaml = YAML.safe_load_file(path)
      return nil unless yaml.is_a?(Hash) && yaml['slug'].is_a?(String)

      Manifest.new(
        slug: yaml['slug'],
        name: yaml['name'],
        planet: yaml['planet'],
        db_namespace: yaml.dig('storage', 'db_namespace'),
        enforced: yaml['enforced'] == true,
        status_association: yaml.dig('feed_projection', 'status_association')&.to_sym,
        status_post_type: yaml.dig('feed_projection', 'status_post_type')
      )
    rescue => e
      Rails.logger.warn("[korners] failed to parse #{path.basename}: #{e.message}")
      nil
    end
  end
end

Rails.application.config.after_initialize do
  next if Rails.env.test?

  begin
    tables = ActiveRecord::Base.connection.tables

    Korners.enforced.each do |manifest|
      prefix = manifest.db_namespace.to_s.chomp('_')

      if prefix.present?
        primary_table = prefix.pluralize
        matches_prefix = tables.include?(primary_table) || tables.any? { |t| t.start_with?("#{prefix}_") }
        Rails.logger.warn("[korners:#{manifest.slug}] db_namespace '#{manifest.db_namespace}' matches no tables") unless matches_prefix
      end

      assoc = manifest.status_association
      Rails.logger.warn("[korners:#{manifest.slug}] Status has no :#{assoc} association") if assoc && Status.reflect_on_association(assoc).nil?
    end
  rescue ActiveRecord::NoDatabaseError, ActiveRecord::ConnectionNotEstablished
    # DB not yet reachable (rake db:setup and similar); skip silently.
  rescue => e
    Rails.logger.warn("[korners] boot-time validation crashed: #{e.class} #{e.message}")
  end
end
