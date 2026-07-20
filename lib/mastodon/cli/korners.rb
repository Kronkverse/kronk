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

        issues = collect_issues
        if issues.empty?
          say 'No drift detected.'
          exit(0) # rubocop:disable Rails/Exit -- tootctl CLI exit code is the CI signal
        end

        issues.each { |line| say line }
        say ''
        say "#{issues.length} #{issues.length == 1 ? 'issue' : 'issues'} found."
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

      def collect_issues
        issues = []
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
        end

        manifests.each do |manifest|
          detect_conformance_issues(manifest).each { |line| issues << "#{manifest.slug}: #{line}" }
        end

        ::Kronk::KornerRegistry.enforced.each do |manifest|
          detect_drift(manifest).each { |line| issues << "#{manifest.slug}: #{line}" }
        end

        detect_orphan_listens(manifests).each { |line| issues << line }
        detect_node_issues.each { |line| issues << line }

        issues
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
        issues << "L1 no config/korners/#{slug}.yaml (slug != filename)" unless File.exist?(Rails.root.join('config', 'korners', "#{slug}.yaml"))

        return issues unless manifest.enforced

        # L1 — canonical nested `security:` block.
        issues << 'L1 no `security:` block (canonical manifest shape)' if manifest.security.blank?

        # L1 — icon wired in the slug->icon map. Korner-only: the map exists to
        # give Hub grid tiles an icon, and a core space has no tile.
        issues << "L1 icon not wired in useKornerIcon (no '#{slug}' key in SLUG_TO_ICON)" if !manifest.core? && !korner_source('app/javascript/mastodon/hooks/useKornerIcon.tsx').match?(/['"]?#{Regexp.escape(slug)}['"]?\s*:/)

        # L5 — the space's mount resolves. Korners default to /hub/<slug>,
        # where a missing mount means a Hub tile that 404s. A core space
        # declares its own `mount:` and is checked against that instead —
        # requiring /hub/feed would be nonsense.
        mount = manifest.mount_path
        issues << "L5 no #{mount} mount in features/ui/index.jsx (#{manifest.core? ? 'core space' : 'enforced korner, dead Hub tile'})" unless korner_source('app/javascript/mastodon/features/ui/index.jsx').include?(mount)

        # L3 — projection is actually serialised.
        assoc = manifest.status_association
        issues << "L3 REST::StatusSerializer does not expose ':#{assoc}' (projection never reaches the client)" if assoc && status_serializer_attributes.exclude?(assoc)

        # L4 — the feed card is registered.
        card = manifest.feed_projection&.dig('card')
        issues << "L4 feed card '#{card}' not registered in korner_cards.tsx (no slug: '#{slug}' entry)" if card.present? && !korner_source('app/javascript/mastodon/components/korner_cards.tsx').match?(/slug:\s*['"]#{Regexp.escape(slug)}['"]/)

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

      # Read a repo source file once (memoised); '' if absent. Lets the
      # doctor introspect the JS registry / mount / icon map from Ruby.
      def korner_source(relative_path)
        (@korner_source_cache ||= {})[relative_path] ||= begin
          path = Rails.root.join(relative_path)
          File.exist?(path) ? File.read(path) : ''
        end
      end

      # The attribute + association names REST::StatusSerializer exposes.
      def status_serializer_attributes
        @status_serializer_attributes ||= begin
          attrs = REST::StatusSerializer._attributes
          attrs = attrs.keys if attrs.respond_to?(:keys)
          refls = REST::StatusSerializer._reflections
          refls = refls.keys if refls.respond_to?(:keys)
          (Array(attrs) + Array(refls)).map(&:to_sym).to_set
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
        Rails.application.routes.routes.map { |r| r.path.spec.to_s.sub(/\(\.:format\)\z/, '') }.uniq.reject do |path|
          # Root-level catch-alls match literally everything, so leaving them
          # in makes the check pass unconditionally — which is how a check
          # ends up green and worthless. Prefix globs like
          # `/hub/kuestions/*path` are kept: they really do serve that subtree.
          path.match?(%r{\A/\*})
        end
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
