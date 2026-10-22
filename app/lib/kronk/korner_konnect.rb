# frozen_string_literal: true

# A manifest's `konnect:` block: the readable list of a korner's Konnections
# and how they work (decisions.md, 2026-10-23; docs/korners/adding_a_korner.md,
# Korner attachments §2.6).
#
#   konnect:
#     make: true            # the Konnect picker offers "New …" here
#     route: /hub/x/new     # optional: where "New …" goes, if not compose.route
#     label: 'New thing'    # optional: what it says, if not compose.label
#     effects:              # what a Konnection with a space does beyond the link
#       - with: krew
#         does: "The Krew joins the event's audience."
#
# `korners doctor` and the korners spec hold it to the code, so the manifest
# stays the true list:
#
#   - the block is a mapping of `make` (true or false), optional `route` (a
#     path) and `label`, and `effects` (a list of `with:` a korner and
#     `does:` a sentence), nothing else;
#   - `make: true` needs somewhere to go and something to say: `route` and
#     `label`, or the manifest's `compose:` for whichever is missing; and a
#     korner that takes links;
#   - every `effects` pair has a handler in Kronk::AttachmentEffects, and every
#     handler's pair is listed in at least one of its two korners' effects.
module Kronk
  module KornerKonnect
    module_function

    KEYS = %w(make route label effects).freeze
    EFFECT_KEYS = %w(with does).freeze

    def issues(manifests)
      by_slug = manifests.index_by(&:slug)
      manifests.flat_map { |manifest| manifest_issues(manifest, by_slug) } + coverage_issues(manifests)
    end

    def manifest_issues(manifest, by_slug)
      raw = manifest.konnect
      return [] if raw.nil?

      slug = manifest.slug
      return ["#{slug}: `konnect:` must be a mapping of `make:` and `effects:`"] unless raw.is_a?(Hash)

      issues = (raw.keys.map(&:to_s) - KEYS).map { |key| "#{slug}: `konnect:` has an unknown key `#{key}` (only #{KEYS.join(', ')})" }
      issues.concat(override_issues(manifest, raw))
      issues.concat(make_issues(manifest, raw))
      issues.concat(effects_issues(manifest, raw, by_slug))
      issues
    end

    def make_issues(manifest, raw)
      return [] unless raw.key?('make')
      return ["#{manifest.slug}: `konnect.make` must be true or false"] unless [true, false].include?(raw['make'])
      return [] unless raw['make']

      issues = []
      issues << "#{manifest.slug}: `konnect.make: true` needs a `konnect.route` or a `compose.route` for \"New …\" to open" if make_route(manifest, raw).blank?
      issues << "#{manifest.slug}: `konnect.make: true` needs a `konnect.label` or a `compose.label` for \"New …\" to say" if make_label(manifest, raw).blank?
      issues << "#{manifest.slug}: `konnect.make: true` but it takes no links (`no_attachments:`)" if manifest.no_attachments.present?
      issues
    end

    def override_issues(manifest, raw)
      issues = []
      issues << "#{manifest.slug}: `konnect.route` must be a path starting with /" if raw.key?('route') && !(raw['route'].is_a?(String) && raw['route'].start_with?('/'))
      issues << "#{manifest.slug}: `konnect.label` must be a non-empty string" if raw.key?('label') && !(raw['label'].is_a?(String) && raw['label'].strip.present?)
      issues
    end

    def make_route(manifest, raw)
      raw['route'].presence || manifest.compose&.dig('route')
    end

    def make_label(manifest, raw)
      raw['label'].presence || manifest.compose&.dig('label')
    end

    def effects_issues(manifest, raw, by_slug)
      return [] unless raw.key?('effects')

      slug = manifest.slug
      return ["#{slug}: `konnect.effects` must be a list of `with:` and `does:`"] unless raw['effects'].is_a?(Array)

      raw['effects'].each_with_index.flat_map do |entry, index|
        where = "#{slug}: `konnect.effects[#{index}]`"
        next ["#{where} must be a mapping of `with:` and `does:`"] unless entry.is_a?(Hash)

        issues = (entry.keys.map(&:to_s) - EFFECT_KEYS).map { |key| "#{where} has an unknown key `#{key}`" }
        with = entry['with']
        issues << "#{where} needs `does:`, a sentence saying what the Konnection does" unless entry['does'].is_a?(String) && entry['does'].strip.present?
        if !with.is_a?(String) || with.blank?
          issues << "#{where} needs `with:`, the korner on the other end"
        elsif !by_slug.key?(with)
          issues << "#{where} names `with: #{with}`, which has no manifest"
        elsif handler_for(slug, with).nil?
          issues << "#{where} lists `with: #{with}`, but Kronk::AttachmentEffects has no handler for #{pair_name(slug, with)}: add one, or take the entry out"
        end
        issues
      end
    end

    # A pair the code acts on that neither manifest lists.
    def coverage_issues(manifests)
      listed = manifests.flat_map { |manifest| effect_pairs(manifest) }.to_set

      Kronk::AttachmentEffects.handlers.filter_map do |pair, handler|
        next if listed.include?(pair)

        "#{pair_name(*pair)}: Kronk::AttachmentEffects runs #{handler.name} for it, but neither manifest lists it under `konnect.effects`; " \
          "add `- with: #{pair.last}` to #{pair.first}.yaml (or `- with: #{pair.first}` to #{pair.last}.yaml) saying what it does"
      end
    end

    def effect_pairs(manifest)
      raw = manifest.konnect
      return [] unless raw.is_a?(Hash) && raw['effects'].is_a?(Array)

      raw['effects'].filter_map do |entry|
        next unless entry.is_a?(Hash) && entry['with'].is_a?(String)

        [manifest.slug, entry['with']].sort
      end
    end

    def handler_for(slug_a, slug_b)
      Kronk::AttachmentEffects.handlers[[slug_a.to_s, slug_b.to_s].sort]
    end

    def pair_name(slug_a, slug_b)
      [slug_a, slug_b].sort.join(' ↔ ')
    end
  end
end
