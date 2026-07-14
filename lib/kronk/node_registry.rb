# frozen_string_literal: true

# Kronk::NodeRegistry — the set of user-facing page-types in Kronk,
# assembled at boot from two sources:
#
#   1. `config/kronk_nodes.yaml` — cross-cutting nodes not owned by a
#      korner (Home timeline, Nudges activity, someone's profile,
#      settings pages, etc.). One YAML file, flat list.
#
#   2. Per-korner `nodes:` blocks in `config/korners/<slug>.yaml`
#      declared alongside the rest of the manifest. `Kronk::KornerRegistry`
#      parses these into `Manifest#nodes`; this registry unions them.
#
# Every node has a **stable id** independent of its URL — feedback
# proposals key on `node_id` so they follow a page across URL changes.
# The rendered URL is a display attribute only.
#
# Consumers:
#   - `GET /api/v1/kommons/nodes` — serves this tree to the frontend
#     (`app/javascript/mastodon/features/kommons_tree/`)
#   - `Proposal.node_id` — feedback proposals tag themselves with a node
#   - `bin/tootctl korners doctor` — anti-drift check
#
# Config shape (both cross-cutting + per-korner):
#
#   - id: booth.index          # stable, unique
#     bucket: hub              # feed | profile | hub
#     parent: booth            # for hub nodes: the korner slug
#     label: Booth home
#     url: /hub/booth
#     route_name: booth        # Rails route :as; used by doctor for drift check
#     lifecycle: live          # live | soon | deprecated | hidden
#     spa: false               # optional; true = React Router only (no Rails route)
#
# See: portal-me kronk-tree-vision brief (2026-07-13 inbox); this file
# implements that spec.

require 'yaml'

module Kronk
  module NodeRegistry
    BUCKETS = %w(feed profile hub).freeze
    LIFECYCLES = %w(live soon deprecated hidden).freeze

    CROSS_CUTTING_FILENAME = 'kronk_nodes.yaml'

    Node = Struct.new(
      :id,
      :bucket,
      :parent,
      :label,
      :url,
      :route_name,
      :lifecycle,
      :spa,
      :source, # :cross_cutting | :korner
      keyword_init: true
    ) do
      def spa?
        spa == true
      end

      def live?
        lifecycle == 'live'
      end
    end

    class << self
      def all
        @all ||= load_all
      end

      def find(id)
        all.find { |n| n.id == id.to_s }
      end

      def for_bucket(bucket)
        all.select { |n| n.bucket == bucket.to_s }
      end

      def in_korner(slug)
        all.select { |n| n.bucket == 'hub' && n.parent == slug.to_s }
      end

      def reload!
        @all = nil
      end

      private

      def load_all
        cross = load_cross_cutting
        from_korners = load_korner_nodes
        (cross + from_korners).each_with_object([]) do |node, out|
          next if out.any? { |n| n.id == node.id } # first-wins on duplicate ids

          out << node
        end
      end

      def load_cross_cutting
        path = Rails.root.join('config', CROSS_CUTTING_FILENAME)
        return [] unless path.file?

        yaml = YAML.safe_load_file(path)
        return [] unless yaml.is_a?(Hash)

        Array(yaml['nodes']).filter_map { |entry| build_node(entry, source: :cross_cutting) }
      rescue => e
        Rails.logger.warn("[kronk:node_registry] failed to load #{CROSS_CUTTING_FILENAME}: #{e.class} #{e.message}")
        []
      end

      def load_korner_nodes
        Kronk::KornerRegistry.all.flat_map do |manifest|
          Array(manifest.nodes).filter_map do |entry|
            # Korner nodes default to bucket:hub, parent:<slug>. Allow
            # override for the rare case a korner declares a node in a
            # different bucket (e.g., a settings-space entry point).
            entry = entry.merge('bucket' => 'hub') unless entry.key?('bucket')
            entry = entry.merge('parent' => manifest.slug) unless entry.key?('parent')
            build_node(entry, source: :korner)
          end
        end
      end

      def build_node(entry, source:)
        return nil unless entry.is_a?(Hash)

        id = entry['id'].to_s
        bucket = entry['bucket'].to_s
        lifecycle = (entry['lifecycle'] || 'live').to_s

        return nil if id.empty? || !BUCKETS.include?(bucket) || !LIFECYCLES.include?(lifecycle)

        Node.new(
          id: id,
          bucket: bucket,
          parent: entry['parent']&.to_s,
          label: entry['label'].to_s,
          url: entry['url'].to_s,
          route_name: entry['route_name']&.to_s,
          lifecycle: lifecycle,
          spa: entry['spa'] == true,
          source: source
        )
      end
    end
  end
end
