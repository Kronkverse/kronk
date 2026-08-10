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
      # Compose action (§K.10) — powers the Ж menu's Post button when
      # the viewer is inside this korner. Shape: { 'label' => String,
      # 'route' => String }. Optional; if absent the menu hides Post.
      :compose,
      # Inter-korner (§6)
      :emits,
      :listens,
      # Hub landing (§4.7)
      :hub_teaser,
      # SpaceNav views (§4 SpaceNav) — the per-korner view switcher the
      # Frame renders in the floating nav. Ordered array of
      # { 'key' => String, 'label' => String, 'tagline' => String? };
      # the first is the default (bare `/hub/<slug>`), the rest map to
      # `/hub/<slug>/<key>`. Empty when the korner has a single view
      # (no picker rendered). Per-view `tagline` is optional and only
      # consumed when `header.rotator` is on.
      :views,
      # Header configuration (§Korner Standard L11). Currently only
      # `rotator` — when true, `<AutoSpaceHeader>` renders the space
      # title as a `<ScopeTitle>` cycling through `views:` instead of
      # a static `name + tagline`. Preserves the "one title per space"
      # rule: the rotator IS the title. Shape: { 'rotator' => Bool }.
      :header,
      # Launch card (§8.7)
      :launch,
      # Space page — the "why" and "who" a member sees when they open the
      # space in the Kommons tree. `purpose` is the evolutionary purpose (why
      # this space was seeded); `steward` is the handle of the account who
      # stewards it (optional — no korner->account link exists yet, so this is
      # a declared handle, not a derived one).
      :purpose,
      # `tagline` is the short, display-voice intro line shown under the
      # space title (the shared `<SpaceIntro>` renders it). Distinct from
      # `purpose` (the mission "why"): tagline is user-facing copy.
      :tagline,
      :steward,
      # Tree nodes (§Kronk 2.0 tree registry) — user-facing page-types
      # owned by this korner. Each entry follows the schema in
      # `lib/kronk/node_registry.rb`. Optional; a korner with no visible
      # surfaces (pure infra) can declare `nodes: []`.
      :nodes,
      # Where this space lives. Absent means `/hub/<slug>` — the korner
      # default. A core space sets it explicitly (`/home`, `/nudges`,
      # `/@:user`) because it is not reached through the Hub.
      :mount,
      # A core space is part of the platform rather than a korner: it cannot
      # be uninstalled, does not appear in the Hub grid, and cannot be tuned
      # out of. It is otherwise an ordinary manifest — this flag and `mount`
      # are the whole of the difference, which is the point.
      :core,
      # A portal korner is a live Kronk-native landing surface (its /hub/<slug>
      # route renders a real component) that links out to an external app.
      # Portals are `enforced: false` because they own no Kronk-side models,
      # feed projections, or notification subsystems — the Standard requires
      # nothing to declare. Shape: { 'url' => String }. Optional; absent means
      # the korner is not a portal. See `you.yaml` for the reference case.
      :portal,
      # Deployment
      :feature_flag,
      :enforced,
      keyword_init: true
    ) do
      # The path this space is mounted at. Korners default to /hub/<slug>;
      # core spaces declare their own.
      def mount_path
        mount.presence || "/hub/#{slug}"
      end

      # Korner-only behaviours: Hub grid membership, tune-in/out, the launch
      # card. Asking `core?` at each of those sites keeps the distinction in
      # one vocabulary instead of scattering slug checks.
      def core?
        core == true
      end

      # Portal korners (see `:portal`) are Hub-live: a real /hub/<slug>
      # component renders, and clicking it either follows the link or
      # opens the external app. They ship at `enforced: false` because
      # they own none of the resources the Standard gates enforced
      # korners on — this predicate is the Hub-side signal to promote
      # them out of the "Coming soon" bucket regardless.
      def portal?
        portal.is_a?(Hash) && portal['url'].is_a?(String) && !portal['url'].empty?
      end

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
          slug: yaml['slug'],
          name: yaml['name'],
          icon: normalize_icon(yaml['icon']),
          render_target: yaml['render_target'],
          version: yaml['version'],
          resources: Array(yaml['resources']),
          storage: yaml['storage'].is_a?(Hash) ? yaml['storage'] : nil,
          security: extract_security(yaml),
          aesthetic: yaml['aesthetic'].is_a?(Hash) ? yaml['aesthetic'] : nil,
          notifications: extract_notification_types(yaml),
          feed_projection: yaml['feed_projection'].is_a?(Hash) ? yaml['feed_projection'] : nil,
          settings: Array(yaml['settings']),
          compose: extract_compose(yaml),
          emits: Array(yaml['emits']),
          listens: Array(yaml['listens']),
          hub_teaser: yaml['hub_teaser'].is_a?(Hash) ? yaml['hub_teaser'] : nil,
          views: extract_views(yaml),
          header: extract_header(yaml),
          launch: yaml['launch'].is_a?(Hash) ? yaml['launch'] : nil,
          purpose: yaml['purpose'].is_a?(String) ? yaml['purpose'] : nil,
          tagline: yaml['tagline'].is_a?(String) ? yaml['tagline'] : nil,
          steward: yaml['steward'].is_a?(String) ? yaml['steward'] : nil,
          nodes: Array(yaml['nodes']),
          mount: yaml['mount'].is_a?(String) ? yaml['mount'] : nil,
          core: yaml['core'] == true,
          portal: yaml['portal'].is_a?(Hash) ? yaml['portal'] : nil,
          feature_flag: yaml['feature_flag'],
          enforced: yaml['enforced'] == true
        )
      rescue => e
        Rails.logger.warn("[kronk:korner_registry] failed to parse #{path.basename}: #{e.message}")
        nil
      end

      # Normalise the manifest `icon:` field into a single shape the
      # frontend can consume uniformly. Legacy manifests carry a bare
      # Material name string; the new shape is a hash with:
      #   material   — Material Symbols name (drives useKornerIcon)
      #   glyph_path — inline SVG path data for the Hub tile line-art
      #                (KornerGlyph)
      # `text_glyph` was retired 2026-08-06 (Tal: "I never asked for
      # them and i reckon they're superfluous"). Any legacy value in
      # a manifest is silently ignored here — the SpaceBadge no
      # longer renders a decorative letter, so nothing consumes it.
      def normalize_icon(raw)
        case raw
        when Hash
          {
            'material' => raw['material'].is_a?(String) ? raw['material'] : nil,
            'glyph_path' => raw['glyph_path'].is_a?(String) ? raw['glyph_path'] : nil,
          }.compact
        when String
          { 'material' => raw }
        end
      end

      # 1.7.0 shape places security fields at top-level (permissions,
      # visibility_scopes, steward_role, federates). §1.1 nests them under
      # `security:`. Prefer nested when present; otherwise synthesise the
      # block from top-level fields so downstream code sees a uniform shape.
      def extract_security(yaml)
        return yaml['security'] if yaml['security'].is_a?(Hash)

        maintainers = yaml['steward_role'].present? ? [yaml['steward_role']] : nil

        {
          'permissions' => yaml['permissions'],
          'visibility_scopes' => yaml['visibility_scopes'],
          'maintainers' => maintainers,
          'federates' => yaml['federates'],
        }.compact
      end

      # Compose action must be a Hash with String label + String route.
      # Anything else (nil, wrong shape, missing field) resolves to nil so
      # the Ж menu hides the Post item for this korner.
      def extract_compose(yaml)
        raw = yaml['compose']
        return nil unless raw.is_a?(Hash)

        label = raw['label'].to_s
        route = raw['route'].to_s
        return nil if label.empty? || route.empty?

        { 'label' => label, 'route' => route }
      end

      # SpaceNav views — an ordered array of `{ key, label, icon? }`
      # hashes. Each entry needs a non-empty String key + label;
      # malformed entries are dropped. Returns [] when absent so a
      # korner with a single view renders no picker. Order is
      # preserved: entry 0 is the default view (bare `/hub/<slug>`).
      #
      # `icon` is optional. When present, the frontend's SpaceViewPicker
      # renders the matching Material Symbol from the shared registry
      # (see `useKornerIcon.tsx#MATERIAL_TO_ICON`) instead of the text
      # label; the label rides on aria-label + tooltip. Applies the
      # 2026-08-04 direction that horizontal pillar navs prefer
      # icon-only rendering.
      def extract_views(yaml)
        raw = yaml['views']
        return [] unless raw.is_a?(Array)

        raw.filter_map do |entry|
          next unless entry.is_a?(Hash)

          key = entry['key'].to_s
          label = entry['label'].to_s
          next if key.empty? || label.empty?

          view = { 'key' => key, 'label' => label }
          icon = entry['icon'].to_s
          view['icon'] = icon unless icon.empty?
          tagline = entry['tagline'].to_s
          view['tagline'] = tagline unless tagline.empty?
          view
        end
      end

      # Optional `header:` block. Exposes:
      #   rotator — Bool. Title becomes `<ScopeTitle>` cycling views.
      #   picker  — 'pills' | 'menu'. Shape of the Frame's view
      #             switcher when rotator is off. Unknown values are
      #             dropped (frontend defaults to pills).
      # Returns nil (not {}) when absent so the frontend can
      # straightforwardly `header?.rotator` / `header?.picker` gate.
      def extract_header(yaml)
        raw = yaml['header']
        return nil unless raw.is_a?(Hash)

        picker = raw['picker'].to_s
        {
          'rotator' => raw['rotator'] == true,
          'picker' => (%w(pills menu).include?(picker) ? picker : nil),
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

    # A core manifest is exempt: the reservation exists to stop a *korner*
    # claiming a platform route, and a core space claiming its own platform
    # route is the reservation working, not failing. Without this, `feed` and
    # `hub` could never have manifests — and the workaround already in use was
    # to un-reserve the slug instead (see the `nudges` note in
    # reserved_slugs.yaml), which gives the protection away entirely.
    manifests.each do |manifest|
      next if manifest.core?

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
