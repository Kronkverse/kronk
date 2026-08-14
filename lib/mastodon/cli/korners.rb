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
          print_standard_coverage
          exit(0) # rubocop:disable Rails/Exit -- tootctl CLI exit code is the CI signal
        end

        issues.each { |line| say line }
        say ''
        summary = "#{issues.length} #{issues.length == 1 ? 'issue' : 'issues'} found"
        summary += ", #{warnings.length} #{warnings.length == 1 ? 'warning' : 'warnings'}" if warnings.any?
        summary += '.'
        say summary
        print_standard_coverage
        exit(1) # rubocop:disable Rails/Exit -- tootctl CLI exit code is the CI signal
      end

      private

      # Printed on every doctor run so the Standard's layers are never
      # invisible just because the doctor can't machine-check them. The
      # failure this closes: the doctor only gates a subset (L1/L2/L3-4/L5/
      # L6/L7/L10/L11-parasites/compose), so a clean run reads as "conforms
      # to the whole Standard" when it only means "no detectable drift". This
      # names every layer and points at where its spec lives — including the
      # ones a human has to verify (settings pages, title PLACEMENT, primitive
      # adoption). Deliberately advisory, like the doctor itself.
      def print_standard_coverage
        say ''
        say "── Standard coverage #{'─' * 39}"
        say 'The doctor gates the machine-checkable layers below. A clean run means'
        say 'no detectable drift — NOT full conformance. Verify the rest by hand.'
        say ''
        say 'Full spec:  docs/korners/korner_standard.md'
        say 'Primitives: docs/kronk_platform_primitives.md'
        say ''
        say 'Checked above:'
        say '  L1 identity+manifest   L2 data+tables    L3/L4 feed card    L5 mount'
        say '  L6 nodes+links         L7 SCSS governed  L10 notifications'
        say '  L11 no chrome parasites (warn)    compose wraps <ComposeShell> (warn)'
        say '  L11 core-space header pulls from manifest (warn)'
        say ''
        say 'NOT machine-checkable — review against the spec section:'
        say '  L8   settings page exists at /hub/<slug>/settings      korner_standard.md §L8'
        say '  L9   model/projection spec, no phantom doc refs        §L9'
        say '  L11  title/tagline PLACEMENT — sits at standard height  §L11 + docs/kronk_frame.md'
        say '  L12  settings render in <Stage> at that same height    §L12'
        say '  --   adopt the shared primitives, do not hand-roll     kronk_platform_primitives.md'
      end

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
          # Core spaces have their own header check (see below); the rest of
          # the per-korner conformance / parasite / feed-card / notifications
          # gates don't apply — see the note at the matching check in
          # config/initializers/kronk_korner_registry.rb.
          if manifest.core?
            detect_core_space_header_drift(manifest).each { |line| warnings << "#{manifest.slug}: #{line}" }
            next
          end

          issues << "#{manifest.slug}: slug is reserved for platform use" if reserved.include?(manifest.slug)

          detect_conformance_issues(manifest).each { |line| issues << "#{manifest.slug}: #{line}" }
          detect_frame_parasites(manifest).each { |line| warnings << "#{manifest.slug}: #{line}" }
          detect_planned_notification_warnings(manifest).each { |line| warnings << "#{manifest.slug}: #{line}" }

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

        # L10 — every notification a manifest declares must be DELIVERABLE by
        # some mechanism, or be honestly marked as not built yet.
        #
        # The original rule asserted "declared ⇒ registered in
        # Notification::PROPERTIES". That was right when the Mastodon
        # notification store was the only delivery path, and is wrong now:
        # `docs/kronk_nudges.md` § _Self-delivering delivery_ made that store
        # legacy-only, and korner activity is migrating to the Nudges event bus
        # (`Kronk::KornerEvents` → the nudges manifest's `listens:` →
        # `Nudges::EventRouter`). Under the old rule a notification correctly
        # delivered by the bus was reported as broken, while the check pointed
        # authors at the mechanism being retired.
        #
        # Note the field itself is NOT legacy: it also drives the per-korner
        # push toggles in `Api::V1::KornersController` (`push_preferences` /
        # `notifications_schema`) and the aggregation windows read by
        # `Nudges::Aggregator.window_for`. It declares "what this korner can
        # notify you about", independent of what delivers it. So each entry
        # says how it is delivered:
        #
        #   delivery: notification  (default) — a registered Notification type
        #   delivery: nudge + event: <name>   — routed on the bus; the event
        #                                       must be both published and
        #                                       consumed, so "fires into the
        #                                       void" is still caught
        #   planned: true                     — declared, not built; a WARNING,
        #                                       mirroring L4's `planned` cards
        Array(manifest.notifications).each do |entry|
          type_name = entry.is_a?(Hash) ? entry['name'] : entry
          next if type_name.blank?

          hash = entry.is_a?(Hash) ? entry : {}

          # `planned` is surfaced as a warning by
          # #detect_planned_notification_warnings, not gated here.
          next if hash['planned']

          case hash['delivery'].to_s
          when 'nudge'
            event = hash['event'].to_s
            if event.blank?
              issues << "L10 notification type '#{type_name}' declares `delivery: nudge` but no `event:` — name the Kronk::KornerEvents event that carries it"
            elsif !bus_event_published?(event)
              issues << "L10 notification type '#{type_name}' names bus event '#{event}', which nothing publishes"
            elsif !bus_event_consumed?(event)
              issues << "L10 notification type '#{type_name}' names bus event '#{event}', which is published but nothing consumes — it fires into the void"
            end
          else
            unless ::Notification::TYPES.include?(type_name.to_sym)
              issues << "L10 notification type '#{type_name}' is not registered in Notification::PROPERTIES (declared but never built — it can never fire). If the Nudges bus delivers it, declare `delivery: nudge` + `event:`; if it is not built yet, `planned: true`"
              next
            end

            subject_type = hash['subject_type']
            next if subject_type.blank?

            model = subject_type.to_s.camelize.safe_constantize
            issues << "L10 notification type '#{type_name}' subject_type '#{subject_type}' resolves to no model" unless model.is_a?(Class) && model < ActiveRecord::Base
          end
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

      # Core-space header drift — the counterpart to L11 for core spaces.
      # Core spaces don't go through <AutoSpaceHeader> (their landing
      # components render outside the /hub/<slug> route the auto-header
      # scopes to), so the risk is the opposite of the korner one:
      # instead of DOUBLING the Frame-provided header, a core space can
      # HAND-ROLL one that silently drifts from its manifest. Settings
      # landed on shadow with hand-rolled "Everything about you, and
      # every korner you are in." while the manifest carried
      # `purpose: "To put the controls for your Kronk experience..."`
      # (Tal 2026-08-14: "the title for settings doesn't seem standard").
      #
      # The check: if the mount source renders a `.space-header__title`
      # inline but doesn't import <SpaceHeader> or <AutoSpaceHeader>,
      # the title is being hand-rolled instead of being pulled from the
      # manifest. Warning-only for now; promote to an issue once every
      # core-space landing runs through <SpaceHeader>.
      def detect_core_space_header_drift(manifest)
        return [] unless manifest.core?

        file, rel_path = resolve_mount_source(manifest)
        return [] unless file

        core_space_header_warnings(manifest, File.read(file), rel_path)
      end

      # Pure body of the core-space header check, separated from I/O so
      # it can be exercised on synthetic source (same pattern as
      # `frame_parasite_warnings` for the korner-side L11).
      def core_space_header_warnings(manifest, raw_source, rel_path)
        source = strip_jsx_comments(raw_source)

        return [] unless source.include?('space-header__title')

        imports_space_header =
          source.match?(%r{from ['"]mastodon/components/space_header['"]}) ||
          source.match?(%r{from ['"]mastodon/components/auto_space_header['"]})

        return [] if imports_space_header

        ["L11 core space hand-rolls `.space-header__title` in #{rel_path} — title/tagline should come from the manifest via <SpaceHeader slug='#{manifest.slug}' /> so an edit to config/korners/#{manifest.slug}.yaml propagates without a client change"]
      end

      # L10 `planned:` notifications — declared so the korner's settings UI can
      # already offer the push toggle, but nothing delivers them yet. Reported
      # as warnings (never gating), the same treatment L4 gives a `planned`
      # feed card: an honest promise is tracked, a silent one is not.
      def detect_planned_notification_warnings(manifest)
        Array(manifest.notifications).filter_map do |entry|
          next unless entry.is_a?(Hash) && entry['planned']

          name = entry['name']
          next if name.blank?

          "L10 notification '#{name}' declared planned — no delivery built yet"
        end
      end

      # Is this Kronk::KornerEvents event published anywhere? Matches the
      # quoted event name near a `publish(` call; the name is sometimes on the
      # line after the call, so this scans a small window rather than one line.
      def bus_event_published?(event)
        bus_source.scan(/KornerEvents\.publish\(\s*['"]([a-z0-9_]+(?:\.[a-z0-9_]+)+)['"]/).flatten.include?(event)
      end

      # Is it consumed? Either declared in the nudges manifest's `listens:`
      # block, or hand-wired via an explicit subscribe. An event that is
      # published but consumed by nobody is the failure this catches.
      def bus_event_consumed?(event)
        return true if Array(Kronk::KornerRegistry.find('nudges')&.listens).any? { |e| e.is_a?(Hash) && e['event'].to_s == event }

        bus_source.include?("subscribe('#{event}'") || bus_source.include?("subscribe(\"#{event}\"")
      end

      # Ruby sources that can publish or subscribe to bus events, concatenated
      # once. Models/services publish; initializers subscribe.
      #
      # Whole-line `#` comments are stripped first, or the scans match
      # DOCUMENTATION rather than code: `lib/kronk/korner_events.rb` carries a
      # usage example reading `KornerEvents.subscribe('huddle.started')`, which
      # made `huddle.started` look consumed when in fact nothing consumes it.
      # That is the same failure as the korner icon check and the file-input
      # guard — a check tripping over prose about the thing instead of the thing
      # — and it surfaced only because the spec insisted this branch be shown
      # going red (decisions.md 2026-08-12, decision 2).
      #
      # Only whole-line comments are removed. A trailing `# …` after real code
      # is left alone: `#` also opens string interpolation, and stripping from
      # it would corrupt live source. A documented example sits on its own
      # line, so whole-line stripping is sufficient here.
      def bus_source
        @bus_source ||= Rails.root.glob('{app,lib,config/initializers}/**/*.rb').sum('') do |f|
          File.read(f).gsub(/^[ \t]*#.*$/, '')
        rescue
          ''
        end
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
      #
      # Line comments are stripped WHEREVER they appear, not only where one
      # starts a line. The earlier `^\s*//` form let a trailing comment
      # survive, so `const y = 1; // was createPortal here` tripped the
      # composer check on its own explanation — the same class of bug as the
      # file-input guard matching its own docstring.
      #
      # The `(?<!:)` guard keeps `https://…` inside a string intact. Without
      # it, everything after such a URL on that line would be discarded,
      # which could hide a real violation sitting after it — a false negative
      # traded for a false positive, which is the worse direction. A `//`
      # inside a non-URL string literal (or a regex literal) is still
      # stripped; both callers only look for JSX/identifier patterns, so the
      # realistic cost is nil and the alternative is a full JS tokeniser.
      #
      # Both callers report a file path with no line number, so collapsing
      # newlines inside block comments is harmless here. Revisit if a caller
      # ever wants line numbers.
      def strip_jsx_comments(src)
        src.gsub(%r{/\*[\s\S]*?\*/}, '').gsub(%r{(?<!:)//[^\n]*}, '')
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

          issues << "node '#{node.id}': no content/kronk/#{org_page_key(node)}.md — /kronk/:page serves any slug, so this node 404s" if org_page_missing?(node)

          ::Kronk::NodeRegistry.links_for(node.id).each do |link|
            next if node_ids.include?(link['to'])

            issues << "node '#{node.id}': links to '#{link['to']}' but no such node is registered"
          end
        end

        issues
      end

      # The `/kronk/*` org space is served by one catch-all route reading
      # markdown out of `content/kronk/`, so the route check above can no
      # longer tell a real page from a typo — `/kronk/:page` matches both, and
      # `KronkController` renders "No content at …" with a 404 for the typo.
      #
      # This is the coverage the catch-all fix would otherwise have cost:
      # for an org node, the page exists if its markdown file does.
      # `/kronk` and `/kronk/about` both resolve to about.md — the bare route
      # passes `defaults: { page: 'about' }`.
      def org_page_key(node)
        node.url.to_s.delete_prefix('/kronk').delete_prefix('/').presence || 'about'
      end

      def org_page_missing?(node)
        return false unless node.lifecycle.to_s == 'live'
        return false unless node.bucket == 'kronk'

        key = org_page_key(node)
        return false if key.include?(':') # a parameterised org node, if one ever lands

        !Rails.root.join('content', 'kronk', "#{key}.md").exist?
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

      # A segment is a literal prefix plus an optional `:param` tail:
      # `settings`, `:page`, `@:acct`. Three cases, and the middle one is the
      # fix:
      #
      # 1. Both sides parameterised (`@:user` vs `@:acct`, `:id` vs `:statusId`)
      #    — the params name the same thing differently, so only the literal
      #    prefix has to agree. `/@:user` still does not match a bare `/:id`:
      #    the node is more specific than the route, which is drift.
      # 2. **Literal node segment against a bare route param** — a match. The
      #    route serves any value there, and a fixed page is one of them.
      # 3. Neither parameterised — plain comparison.
      #
      # Case 2 was previously impossible: the old version compared
      # `split(':').first` on both sides, which for a bare `:page` is `''`, so
      # no literal could ever equal it. Every page served by a catch-all route
      # therefore read as drift — `/kronk/:page` serves how-it-works, values,
      # governance, contributors, rules, announcements and contact, and all
      # seven were false positives. They were also the only thing between this
      # job and green, and a check that is always red teaches people to ignore
      # it.
      #
      # Route params are not tested against their constraint regex, so a match
      # means "something is mounted at this shape", not "this page renders".
      # That is the drift question; rendering is what request specs are for.
      def segment_matches?(node_seg, route_seg)
        node_seg = node_seg.to_s
        route_seg = route_seg.to_s

        return true if route_seg.start_with?('*')

        node_prefix = node_seg.split(':').first.to_s
        route_prefix = route_seg.split(':').first.to_s

        if node_seg.include?(':') && route_seg.include?(':')
          node_prefix.casecmp?(route_prefix)
        elsif route_seg.include?(':')
          node_seg.downcase.start_with?(route_prefix.downcase)
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
