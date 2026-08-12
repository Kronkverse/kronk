# frozen_string_literal: true

require_relative 'base'

module Mastodon
  module CLI
    class Korners < Base
      desc 'list', 'List every Korner declared under config/korners/ and its drift'
      long_desc <<~LONG
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

        header_row = %w(slug version enforced drift)
        rows = ::Kronk::KornerRegistry.all.map do |manifest|
          drift = detect_drift(manifest)
          [
            manifest.slug,
            manifest.version.to_s,
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

      desc 'describe SLUG', 'Dump a Korner manifest as YAML'
      long_desc <<~LONG
        Prints the parsed manifest for the given SLUG. Structural blocks
        (storage, security, feed_projection, etc.) render as nested YAML.

        Exits non-zero when no manifest matches SLUG.
      LONG
      def describe(slug)
        Rails.application.eager_load!
        manifest = ::Kronk::KornerRegistry.find(slug)

        if manifest.nil?
          say "No manifest found for slug '#{slug}'."
          exit(1) # rubocop:disable Rails/Exit -- tootctl CLI; exit codes signal drift to CI
        end

        say YAML.dump(manifest.to_h.transform_keys(&:to_s))
      end

      desc 'doctor', 'Run the boot validator synchronously against every enforced manifest'
      long_desc <<~LONG
        Runs every check the boot-time validator would run (duplicate slug,
        reserved slug collision, missing DB tables, missing Status
        associations) and prints a summary.

        Exits non-zero when any drift is detected — meant to be wired into
        CI as a gate.
      LONG
      def doctor
        Rails.application.eager_load!
        require_relative '../../kronk/version'
        # NodeRegistry lives in lib/ and isn't eager-loaded in the tootctl
        # context (KornerRegistry is, via its initializer) — require it so the
        # node checks don't crash with an uninitialized-constant NameError.
        say "Korner framework doctor (Kronk v#{::Kronk::Version})"
        say ''

        issues, warnings = collect_issues_and_warnings

        warnings.each { |line| say "warning: #{line}" }
        say '' if warnings.any?

        if issues.empty?
          if warnings.any?
            say "#{warnings.length} #{warnings.length == 1 ? 'warning' : 'warnings'}; no drift."
          else
            say 'No drift detected.'
          end
          exit(0) # rubocop:disable Rails/Exit -- tootctl CLI exit code is the CI signal
        end

        issues.each { |line| say line }
        say ''
        summary = "#{issues.length} #{issues.length == 1 ? 'issue' : 'issues'} found"
        summary += ", #{warnings.length} #{warnings.length == 1 ? 'warning' : 'warnings'}" if warnings.any?
        summary += '.'
        say summary
        exit(1) # rubocop:disable Rails/Exit -- tootctl CLI exit code is the CI signal
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

      def collect_issues_and_warnings
        issues = []
        warnings = []
        manifests = ::Kronk::KornerRegistry.all
        reserved  = ::Kronk::KornerRegistry.reserved_slugs

        manifests.map(&:slug).tally.each do |slug, count|
          issues << "duplicate slug '#{slug}' declared #{count} times" if count > 1
        end

        manifests.each do |manifest|
          # Core spaces are exempt — see the note at the matching check in
          # config/initializers/kronk_korner_registry.rb.
          next if manifest.core?

          issues << "#{manifest.slug}: slug is reserved for platform use" if reserved.include?(manifest.slug)

          detect_conformance_issues(manifest).each { |line| issues << "#{manifest.slug}: #{line}" }
          detect_frame_parasites(manifest).each { |line| warnings << "#{manifest.slug}: #{line}" }

          card_issues, card_warnings = detect_feed_card_issues(manifest)
          card_issues.each { |line| issues << "#{manifest.slug}: #{line}" }
          card_warnings.each { |line| warnings << "#{manifest.slug}: #{line}" }
        end

        ::Kronk::KornerRegistry.enforced.each do |manifest|
          detect_drift(manifest).each { |line| issues << "#{manifest.slug}: #{line}" }
        end

        detect_orphan_listens(manifests).each { |line| issues << line }
        detect_node_issues.each { |line| issues << line }
        detect_composer_conformance_warnings.each { |line| warnings << line }

        [issues, warnings]
      end

      # Backwards-compatible view for callers that only want issues.
      def collect_issues
        collect_issues_and_warnings.first
      end

      # Feed-projection card conformance (Korner Standard L3+L4), checked for
      # EVERY korner that declares a card — enforced or not — so a stub can't
      # promise a phantom card the framework never renders. A card declared
      # `feed_projection.planned: true` is a tracked TODO (warning), not a hard
      # failure; any other declared card MUST be built: its adapter registered
      # in korner_cards.tsx (L4) and, when a `status_association` is named, that
      # association actually serialised by REST::StatusSerializer (L3). Returns
      # [issues, warnings].
      def detect_feed_card_issues(manifest)
        issues = []
        warnings = []
        projection = manifest.feed_projection
        card = projection&.dig('card')
        return [issues, warnings] if card.blank?

        if projection['planned']
          warnings << "L4 feed card '#{card}' declared planned — projection not yet built (L3/L4 not enforced)"
          return [issues, warnings]
        end

        slug = manifest.slug

        unless korner_source('app/javascript/mastodon/components/korner_cards.tsx').match?(/slug:\s*['"]#{Regexp.escape(slug)}['"]/)
          issues << "L4 feed card '#{card}' not registered in korner_cards.tsx (no slug: '#{slug}' entry) — declare `feed_projection.planned: true` if the projection is not built yet"
        end

        assoc = manifest.status_association
        issues << "L3 REST::StatusSerializer does not expose ':#{assoc}' (projection never reaches the client)" if assoc && status_serializer_attributes.exclude?(assoc)

        [issues, warnings]
      end

      # Korner Standard (docs/korners/korner_standard.md §3) conformance —
      # the checks the doctor historically MISSED, so an `enforced` korner
      # that doesn't actually work end-to-end can no longer pass. Identity
      # (L1 slug/file) applies at every stage; the rest is enforced-gated
      # since a `soon`/`building` korner is legitimately incomplete.
      def detect_conformance_issues(manifest)
        issues = []
        slug = manifest.slug

        # L1 — slug is one lowercase word, and names its own manifest file.
        issues << "L1 slug '#{slug}' is not one lowercase word (a-z0-9)" unless slug.match?(/\A[a-z0-9]+\z/)
        issues << "L1 no config/korners/#{slug}.yaml (slug != filename)" unless Rails.root.join('config', 'korners', "#{slug}.yaml").exist?

        return issues unless manifest.enforced

        # L1 — canonical nested `security:` block. `extract_security` synthesises
        # a block from legacy root-level fields (permissions/visibility_scopes/
        # steward_role/federates), so `manifest.security` is never blank for a
        # legacy manifest — it papers over the difference. Read the raw manifest
        # to tell canonical from legacy: a top-level `security:` key means the
        # nested (canonical) shape; its absence means the synthesised legacy one.
        manifest_path = Rails.root.join('config', 'korners', "#{slug}.yaml")
        raw_manifest = File.exist?(manifest_path) ? File.read(manifest_path) : ''
        if manifest.security.blank?
          issues << 'L1 no `security:` block (canonical manifest shape)'
        elsif !raw_manifest.match?(/^security:/)
          issues << 'L1 legacy root-level security shape — migrate to a nested `security:` block'
        end

        # L1 — the manifest's icon resolves to a real component. Korner-only:
        # the map exists to give Hub grid tiles an icon, and a core space has
        # no tile. `useKornerIcon.tsx` is keyed by **Material Symbols name**
        # (MATERIAL_TO_ICON), not by slug, so the manifest's `icon.material`
        # value is what has to be present. (This check used to grep the file
        # for the slug against a `SLUG_TO_ICON` map that does not exist, so it
        # failed for every korner regardless of wiring.)
        unless manifest.core?
          material = manifest.icon.is_a?(Hash) ? manifest.icon['material'] : nil

          if material.blank?
            issues << 'L1 no `icon.material` in the manifest (nothing for useKornerIcon to resolve)'
          elsif material_icon_names.exclude?(material)
            issues << "L1 icon '#{material}' not wired in useKornerIcon (no '#{material}' key in MATERIAL_TO_ICON — import the SVG and add a row)"
          end
        end

        # L5 — the space's mount resolves. Korners default to /hub/<slug>,
        # where a missing mount means a Hub tile that 404s. A core space
        # declares its own `mount:` and is checked against that instead —
        # requiring /hub/feed would be nonsense.
        mount = manifest.mount_path
        issues << "L5 no #{mount} mount in features/ui/index.jsx (#{manifest.core? ? 'core space' : 'enforced korner, dead Hub tile'})" unless korner_source('app/javascript/mastodon/features/ui/index.jsx').include?(mount)

        # L3/L4 — the feed card. Checked for every korner (enforced or not) in
        # detect_feed_card_issues, so a stub can't declare a phantom card; see
        # there.

        # L7 — every korner-owned SCSS file is in the stylelint governance
        # list. The governance list applies `color-no-hex` +
        # `border-radius` token-only rules; SCSS not on the list can drift
        # in raw hexes and legacy pre-token vars without lint catching it.
        # Convention: a korner ships `_<slug>.scss` (main styles) and
        # optionally `_status_<slug>_card.scss` (feed-card partial). Only
        # files that actually exist are enforced — a korner with no SCSS
        # of its own is fine.
        stylelint_governance_list.tap do |governed|
          expected_scss_files(slug).each do |scss_relative_path|
            next unless Rails.root.join(scss_relative_path).exist?
            next if governed.include?(scss_relative_path)

            issues << "L7 SCSS '#{scss_relative_path}' is not in the stylelint governance list (raw hex + legacy tokens can drift; add it to stylelint.config.js)"
          end
        end

        # L10 — every notification type the manifest declares is actually a
        # registered `Notification` type, and its subject resolves to a model.
        # This is the check the doctor historically lacked: a korner could
        # declare a whole notification subsystem (Kommons declared five) of
        # which only some — or none — were ever built, and nothing caught it.
        # A declared-but-unregistered type never fires, so the manifest is
        # promising a surface that does not exist.
        Array(manifest.notifications).each do |entry|
          type_name = entry.is_a?(Hash) ? entry['name'] : entry
          next if type_name.blank?

          unless ::Notification::TYPES.include?(type_name.to_sym)
            issues << "L10 notification type '#{type_name}' is not registered in Notification::PROPERTIES (declared but never built — it can never fire)"
            next
          end

          subject_type = entry['subject_type'] if entry.is_a?(Hash)
          next if subject_type.blank?

          model = subject_type.to_s.camelize.safe_constantize
          issues << "L10 notification type '#{type_name}' subject_type '#{subject_type}' resolves to no model" unless model.is_a?(Class) && model < ActiveRecord::Base
        end

        issues
      end

      # L11 — Frame parasite check (warning, not gating). The Kronk Frame
      # provides three chrome slots for every /hub/<slug> route via the
      # shared Auto* components:
      #
      #   * AutoSpaceBadge — the space title (manifest `name`)
      #   * AutoSpaceHeader — the in-content title + tagline (manifest `name` + `tagline`)
      #   * AutoSpaceViewPicker — the tab row (manifest `views:`)
      #
      # A korner that renders its own <h1>, tab UI, or inlines a paragraph
      # of the manifest tagline builds a doubled surface — the exact bug
      # that landed on Klot pre-alpha.225 and was easy to miss in review.
      # This check greps the file mounted at `/hub/<slug>` for the
      # tell-tale patterns and warns. It stays a warning until every
      # shipped korner is clean; then it can be promoted to an issue.
      #
      # The mount resolves via ui/index.jsx (WrappedRoute path→component)
      # → async-components.js (component name → import path) → the
      # feature index file. Any hop that can't be resolved silently
      # skips: the L5 mount check already covers total absence, and a
      # false negative here is much cheaper than a false positive
      # training people to ignore the doctor.
      def detect_frame_parasites(manifest)
        return [] if manifest.core?

        file, rel_path = resolve_mount_source(manifest)
        return [] unless file

        frame_parasite_warnings(manifest, File.read(file), rel_path)
      end

      # The pattern-matching body of L11, separated from I/O so it can
      # be exercised on synthetic source without staging fixture files.
      def frame_parasite_warnings(manifest, raw_source, rel_path)
        warnings = []
        source = strip_jsx_comments(raw_source)

        warnings << "L11 <h1> in #{rel_path} — Frame provides the space title via AutoSpaceBadge (retire the local hero)" if source.match?(/<h1[\s>]/)

        if manifest.views.present? &&
           (source.match?(/role\s*=\s*['"]tablist['"]/) ||
            source.match?(/role\s*=\s*['"]tab['"]/))
          warnings << "L11 tab UI in #{rel_path} — Frame provides the view picker via AutoSpaceViewPicker from manifest `views:` (retire the local tab row)"
        end

        if manifest.tagline.is_a?(String) && manifest.tagline.strip.length >= 20
          snippet = manifest.tagline.strip[0, 40]
          warnings << "L11 tagline literal in #{rel_path} — Frame provides the tagline via AutoSpaceHeader from manifest `tagline:` (retire the local intro paragraph)" if source.include?(snippet)
        end

        warnings
      end

      # Resolve the /hub/<slug> mount to the source file that renders it,
      # walking ui/index.jsx → async-components.js → features/**. Returns
      # [Pathname, relative_string] or [nil, nil] if any hop fails.
      def resolve_mount_source(manifest)
        mount = manifest.mount_path
        mount_re = /path=['"]#{Regexp.escape(mount)}['"][^>]*component=\{([A-Z]\w+)\}/
        component = korner_source('app/javascript/mastodon/features/ui/index.jsx').match(mount_re)&.captures&.first
        return [nil, nil] unless component

        async_re = /export function #{Regexp.escape(component)}\s*\([^)]*\)\s*\{[^{}]*?return import\(\s*['"]([^'"]+)['"]\s*\)/m
        import_rel = korner_source('app/javascript/mastodon/features/ui/util/async-components.js').match(async_re)&.captures&.first
        return [nil, nil] unless import_rel

        base = Pathname.new('app/javascript/mastodon/features/ui/util')
        target = (base + import_rel).cleanpath

        candidates = [
          Rails.root.join("#{target}.tsx"),
          Rails.root.join("#{target}.jsx"),
          Rails.root.join(target.to_s, 'index.tsx'),
          Rails.root.join(target.to_s, 'index.jsx'),
        ]
        file = candidates.find(&:exist?)
        return [nil, nil] unless file

        [file, file.to_s.sub("#{Rails.root}/", '')] # rubocop:disable Rails/FilePath -- stripping Rails.root prefix, not building a path
      end

      # Strip `/* … */` blocks and line comments so commented `<h1>` notes
      # (or the tagline quoted inside a comment) don't false-positive.
      def strip_jsx_comments(src)
        src.gsub(%r{/\*[\s\S]*?\*/}, '').gsub(%r{^\s*//[^\n]*$}, '')
      end

      # Composer conformance — the 2026-08-12 standard: every korner's
      # "create a new thing" surface goes through the shared
      # `<ComposeShell>` primitive at a canonical `/hub/<slug>/composer`
      # URL (see `docs/rebuild/decisions.md`). Doctor scans every
      # `*composer*.tsx` under `features/**/` and flags files that
      # missed the standard — bespoke portal, `openModal` dispatch,
      # local `<ComposeFab>`, or no `ComposeShell` import at all.
      #
      # Warning-level so a WIP composer can land without blocking the
      # rest of the doctor; promote to `issues` once the standard is
      # settled and any legit exceptions are handled. Pre-fork Mastodon
      # `features/compose/` (the classic feed-post composer) is
      # excluded — it's not a korner composer and predates the shell.
      def detect_composer_conformance_warnings
        warnings = []
        Rails.root.glob('app/javascript/mastodon/features/**/*composer*.tsx').each do |file|
          rel_path = file.to_s.sub("#{Rails.root}/", '') # rubocop:disable Rails/FilePath -- stripping Rails.root prefix, not building a path
          next if rel_path.include?('/features/compose/')

          composer_conformance_warnings(File.read(file), rel_path).each { |line| warnings << line }
        end
        warnings.sort
      end

      # Pure pattern-matching body — same shape as
      # `frame_parasite_warnings` above so it can be exercised on
      # synthetic source in specs without staging a real file tree.
      def composer_conformance_warnings(raw_source, rel_path)
        warnings = []
        source = strip_jsx_comments(raw_source)

        warnings << "compose: #{rel_path} — no ComposeShell import (bespoke composer — wrap in <ComposeShell>)" unless source.include?('ComposeShell')

        warnings << "compose: #{rel_path} — uses createPortal directly (bespoke portal — wrap in <ComposeShell>)" if source.include?('createPortal')

        warnings << "compose: #{rel_path} — dispatches openModal (bespoke modal — wrap in <ComposeShell>)" if source.match?(/\bopenModal\s*\(/)

        warnings << "compose: #{rel_path} — renders local <ComposeFab> (retire; Ж bubble is the site-wide entry)" if source.match?(%r{<ComposeFab[\s/>]})

        warnings
      end

      # Read a repo source file once (memoised); '' if absent. Lets the
      # doctor introspect the JS registry / mount / icon map from Ruby.
      def korner_source(relative_path)
        (@korner_source_cache ||= {})[relative_path] ||= begin
          path = Rails.root.join(relative_path)
          File.exist?(path) ? File.read(path) : ''
        end
      end

      # Material Symbols names wired into `useKornerIcon.tsx`'s
      # MATERIAL_TO_ICON map — the only place a manifest's `icon.material`
      # can resolve to a component. Parsed from the source rather than
      # duplicated here, so the check can't drift from the map.
      #
      # MATERIAL_TO_ICON_FILLED is deliberately ignored: it's an optional
      # subset (only glyphs shipping a `-fill.svg`) and missing entries fall
      # back to the outline, so absence from it is not a conformance failure.
      def material_icon_names
        @material_icon_names ||= begin
          body = korner_source('app/javascript/mastodon/hooks/useKornerIcon.tsx')[/^const MATERIAL_TO_ICON\b[^=]*=\s*\{\n(.*?)^\};$/m, 1].to_s
          body.scan(/^\s*['"]?([a-z0-9_]+)['"]?\s*:/).flatten
        end
      end

      # SCSS files a korner is expected to have. Only ones that actually
      # exist are enforced by the L7 check — a korner without a card
      # partial (yet) doesn't need it in the governance list.
      def expected_scss_files(slug)
        [
          "app/javascript/styles/mastodon/_#{slug}.scss",
          "app/javascript/styles/mastodon/_status_#{slug}_card.scss",
        ]
      end

      # Parse stylelint.config.js once and return the governance list
      # (the `files:` array under the token-enforcing overrides block).
      # We match by literal string extraction — the config file is
      # hand-authored JS, and the file paths inside the array are
      # single-line quoted strings, so a regex over that section is
      # good enough without loading Node.
      def stylelint_governance_list
        @stylelint_governance_list ||= begin
          config_path = Rails.root.join('stylelint.config.js')
          if File.exist?(config_path)
            File.read(config_path).scan(%r{'(app/javascript/styles/mastodon/_[^']+\.scss)'}).flatten.to_set
          else
            Set.new
          end
        end
      end

      # The attribute + association names REST::StatusSerializer exposes.
      def status_serializer_attributes
        @status_serializer_attributes ||= begin
          attrs = REST::StatusSerializer._attributes
          attrs = attrs.keys if attrs.respond_to?(:keys)
          refls = REST::StatusSerializer._reflections
          refls = refls.keys if refls.respond_to?(:keys)
          (Array(attrs) + Array(refls)).to_set(&:to_sym)
        end
      end

      # Kommons Skeleton nodes: structure, referential integrity, and whether
      # each node's URL actually goes anywhere.
      def detect_node_issues
        issues = []
        nodes = ::Kronk::NodeRegistry.all
        node_ids = nodes.to_set(&:id)
        korner_slugs = ::Kronk::KornerRegistry.all.to_set(&:slug)

        nodes.each do |node|
          issues << "node '#{node.id}': parent slug '#{node.parent}' is not a registered korner" if node.bucket == 'hub' && node.parent.present? && !korner_slugs.include?(node.parent)

          issues << "node '#{node.id}': route_name '#{node.route_name}' has no matching Rails route" if node.route_name.present? && !node.spa? && !rails_route_exists?(node.route_name)

          issues << "node '#{node.id}': url '#{node.url}' matches no Rails route and no React Router path" if node_url_drifted?(node)

          ::Kronk::NodeRegistry.links_for(node.id).each do |link|
            next if node_ids.include?(link['to'])

            issues << "node '#{node.id}': links to '#{link['to']}' but no such node is registered"
          end
        end

        issues
      end

      def rails_route_exists?(name)
        Rails.application.routes.named_routes.key?(name.to_sym)
      end

      # Does this node point at a page that exists?
      #
      # The `route_name` check above only covers nodes with a Rails *named*
      # route, and skips anything marked `spa: true` — which, since the
      # registry filled out, is most of it. That left the anti-drift check
      # covering a shrinking minority while the rest could rot silently: a
      # React route renamed, a korner mount removed, and no node complains.
      #
      # Only `live` nodes are held to this. A `soon` surface legitimately has
      # no route yet — that is what `soon` means — and failing it would just
      # train people to ignore the doctor.
      def node_url_drifted?(node)
        return false unless node.lifecycle.to_s == 'live'
        return false if node.url.to_s.strip.empty?
        return false unless node.url.to_s.start_with?('/')
        # If the route table could not be read at all, stay quiet rather than
        # reporting every node as broken — a parse failure is not drift, and
        # burying real issues under 40 false ones is worse than not checking.
        return false if route_patterns.empty?

        route_patterns.none? { |pattern| url_matches_pattern?(node.url, pattern) }
      end

      # Every path the app can serve: Rails routes plus the React Router
      # table, which Rails knows nothing about.
      def route_patterns
        @route_patterns ||= (rails_route_paths + react_route_paths).uniq
      end

      def rails_route_paths
        Rails.application.routes.routes.map { |r| r.path.spec.to_s.delete_suffix('(.:format)') }.uniq.grep_v(%r{\A/\*})
      end

      # Parsed out of the JSX rather than executed. Brittle if the route
      # declarations change shape — hence the empty-table guard above, which
      # turns a parser failure into silence instead of a wall of false drift.
      def react_route_paths
        korner_source('app/javascript/mastodon/features/ui/index.jsx')
          .scan(/path=\{?\[?([^}\]>]+?)\]?\}?\s/)
          .flatten
          .flat_map { |fragment| fragment.scan(/['"]([^'"]+)['"]/).flatten }
          .select { |path| path.start_with?('/') }
          .uniq
      end

      # Segment-wise match. Node URLs and route patterns name their params
      # differently (`/@:user/:id` against `/@:acct/:statusId`), so params
      # compare as wildcards — but the literal part of a segment still has to
      # agree, or `@:acct` would match a bare `:id`.
      def url_matches_pattern?(url, pattern)
        u = url.to_s.split('/').reject(&:empty?)
        p = pattern.to_s.split('/').reject(&:empty?)

        # A trailing optional param may simply be absent.
        p = p[0..-2] if p.length == u.length + 1 && p.last.to_s.end_with?('?')

        glob = p.index { |seg| seg.start_with?('*') }
        if glob
          return false if u.length < glob

          return p[0...glob].each_with_index.all? { |seg, i| segment_matches?(u[i], seg) }
        end

        return false unless p.length == u.length

        p.each_with_index.all? { |seg, i| segment_matches?(u[i], seg) }
      end

      def segment_matches?(node_seg, route_seg)
        return true if route_seg.start_with?('*')

        if node_seg.include?(':') || route_seg.include?(':')
          node_seg.split(':').first.to_s.casecmp?(route_seg.split(':').first.to_s)
        else
          node_seg.casecmp?(route_seg)
        end
      end

      # A manifest's `listens:` block names events it wants to react to.
      # If no other manifest declares that event under `emits:`, the
      # listener will never fire — likely a typo or a dropped emitter.
      def detect_orphan_listens(manifests)
        emitted = manifests.flat_map do |m|
          Array(m.emits).filter_map { |e| e.is_a?(Hash) ? e['name'] : e }
        end.to_set

        manifests.flat_map do |m|
          Array(m.listens).filter_map do |listen|
            name = listen.is_a?(Hash) ? listen['name'] : listen
            next unless name.is_a?(String)
            next if emitted.include?(name)

            "#{m.slug}: listens for '#{name}' but no manifest emits it"
          end
        end
      end
    end
  end
end
