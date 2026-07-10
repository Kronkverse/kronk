# frozen_string_literal: true

# Kronk::KornerRegistry — manifest registry + boot-time drift check.
#
# Loads config/korners/*.yaml and exposes each declared Korner as a
# Kronk::KornerRegistry::Manifest struct. Manifests with `enforced: true`
# get a light drift check on boot: table prefix must exist, declared
# Status association must be defined. Drift is logged as a warning; boot
# never fails on manifest mismatch — the goal is to make drift visible in
# the server log, not to wedge production.
#
# The parser tolerates both the shape shipped in 1.7.0 (security fields
# at top-level, no notifications/settings/aesthetic blocks) and the fuller
# shape defined in docs/kronk_korner_spec.md §1.1 (nested `security:`,
# `notifications:`, `settings:`, `aesthetic:`, `hub_teaser:` blocks).
# Missing blocks resolve to nil or empty arrays as appropriate.
#
# Companion JS-side registry:
#   app/javascript/mastodon/components/korner_cards.tsx
#
# See docs/kronk_korner_spec.md and docs/korners/adding_a_korner.md.

require 'yaml'

module Kronk
  module KornerRegistry
    Manifest = Struct.new(
      # Identity (§1.1)
      :slug,
      :name,
      :icon,
      :render_target,
      :version,
      # Structure
      :resources,
      :storage,
      :security,
      :aesthetic,
      :notifications,
      :feed_projection,
      :settings,
      # Inter-korner (§6)
      :emits,
      :listens,
      # Hub landing (§4.7)
      :hub_teaser,
      # Launch card (§8.7)
      :launch,
      # Deployment
      :feature_flag,
      :enforced,
      keyword_init: true
    ) do
      def db_namespace
        storage&.dig('db_namespace')
      end

      def media_prefix
        storage&.dig('media_prefix')
      end

      def redis_prefix
        storage&.dig('redis_prefix')
      end

      def status_association
        feed_projection&.dig('status_association')&.to_sym
      end

      def status_post_type
        feed_projection&.dig('status_post_type')
      end

      def maintainers
        Array(security&.dig('maintainers'))
      end

      def visibility_scopes
        Array(security&.dig('visibility_scopes'))
      end

      def federates?
        security&.dig('federates') == true
      end
    end

    RESERVED_SLUGS_FILENAME = 'reserved_slugs.yaml'

    class << self
      def all
        @all ||= load_manifests
      end

      def enforced
        all.select(&:enforced)
      end

      def find(slug)
        all.find { |m| m.slug == slug.to_s }
      end

      def reserved_slugs
        @reserved_slugs ||= load_reserved_slugs
      end

      def reload!
        @all = nil
        @reserved_slugs = nil
      end

      private

      def load_manifests
        dir = Rails.root.join('config', 'korners')
        return [] unless dir.directory?

        dir.glob('*.yaml')
           .reject { |path| path.basename.to_s == RESERVED_SLUGS_FILENAME }
           .filter_map { |path| parse_manifest(path) }
      end

      def load_reserved_slugs
        path = Rails.root.join('config', 'korners', RESERVED_SLUGS_FILENAME)
        return [] unless path.file?

        list = YAML.safe_load_file(path)
        return [] unless list.is_a?(Array)

        list.filter_map { |slug| slug.to_s.presence }
      end

      def parse_manifest(path)
        yaml = YAML.safe_load_file(path)
        return nil unless yaml.is_a?(Hash) && yaml['slug'].is_a?(String)

        Manifest.new(
          slug:            yaml['slug'],
          name:            yaml['name'],
          icon:            yaml['icon'],
          render_target:   yaml['render_target'],
          version:         yaml['version'],
          resources:       Array(yaml['resources']),
          storage:         yaml['storage'].is_a?(Hash) ? yaml['storage'] : nil,
          security:        extract_security(yaml),
          aesthetic:       yaml['aesthetic'].is_a?(Hash) ? yaml['aesthetic'] : nil,
          notifications:   extract_notification_types(yaml),
          feed_projection: yaml['feed_projection'].is_a?(Hash) ? yaml['feed_projection'] : nil,
          settings:        Array(yaml['settings']),
          emits:           Array(yaml['emits']),
          listens:         Array(yaml['listens']),
          hub_teaser:      yaml['hub_teaser'].is_a?(Hash) ? yaml['hub_teaser'] : nil,
          launch:          yaml['launch'].is_a?(Hash) ? yaml['launch'] : nil,
          feature_flag:    yaml['feature_flag'],
          enforced:        yaml['enforced'] == true
        )
      rescue => e
        Rails.logger.warn("[kronk:korner_registry] failed to parse #{path.basename}: #{e.message}")
        nil
      end

      # 1.7.0 shape places security fields at top-level (permissions,
      # visibility_scopes, steward_role, federates). §1.1 nests them under
      # `security:`. Prefer nested when present; otherwise synthesise the
      # block from top-level fields so downstream code sees a uniform shape.
      def extract_security(yaml)
        return yaml['security'] if yaml['security'].is_a?(Hash)

        maintainers = yaml['steward_role'].present? ? [yaml['steward_role']] : nil

        {
          'permissions'       => yaml['permissions'],
          'visibility_scopes' => yaml['visibility_scopes'],
          'maintainers'       => maintainers,
          'federates'         => yaml['federates']
        }.compact
      end

      # Notifications may arrive as either `notifications: [<type>, ...]`
      # or `notifications: { types: [<type>, ...] }`. Normalise to a flat array.
      def extract_notification_types(yaml)
        raw = yaml['notifications']
        return raw if raw.is_a?(Array)
        return Array(raw['types']) if raw.is_a?(Hash)

        []
      end
    end
  end
end

# Deprecated alias — remove after one release. External callers still
# using `Korners` continue to work until this constant is dropped.
Korners = Kronk::KornerRegistry

Rails.application.config.after_initialize do
  next if Rails.env.test?

  begin
    manifests = Kronk::KornerRegistry.all
    reserved  = Kronk::KornerRegistry.reserved_slugs

    manifests.map(&:slug).tally.each do |slug, count|
      Rails.logger.warn("[kronk:korner_registry] slug '#{slug}' declared by #{count} manifests") if count > 1
    end

    manifests.each do |manifest|
      Rails.logger.warn("[kronk:korner_registry:#{manifest.slug}] slug is reserved for platform use") if reserved.include?(manifest.slug)
    end

    tables = ActiveRecord::Base.connection.tables

    Kronk::KornerRegistry.enforced.each do |manifest|
      prefix = manifest.db_namespace.to_s.chomp('_')

      if prefix.present?
        primary_table = prefix.pluralize
        matches_prefix = tables.include?(primary_table) || tables.any? { |t| t.start_with?("#{prefix}_") }
        Rails.logger.warn("[kronk:korner_registry:#{manifest.slug}] db_namespace '#{manifest.db_namespace}' matches no tables") unless matches_prefix
      end

      assoc = manifest.status_association
      Rails.logger.warn("[kronk:korner_registry:#{manifest.slug}] Status has no :#{assoc} association") if assoc && Status.reflect_on_association(assoc).nil?
    end
  rescue ActiveRecord::NoDatabaseError, ActiveRecord::ConnectionNotEstablished
    # DB not yet reachable (rake db:setup and similar); skip silently.
  rescue => e
    Rails.logger.warn("[kronk:korner_registry] boot-time validation crashed: #{e.class} #{e.message}")
  end
end
