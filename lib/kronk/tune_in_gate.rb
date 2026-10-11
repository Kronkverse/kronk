# frozen_string_literal: true

# Filters a batch of Statuses down to those the given account is tuned
# in to see, per spec §8.4.2 (the tune-in gate on the feed). Tuning is
# the one lever for whether a korner reaches your feed: Home at every
# reach and Kommunity.
#
# Gated behind Kronk::FeatureFlags.enabled?(:tune_in_enforced) — on in
# production since 2026-10-11 (docs/decisions.md); off in development and
# test unless a spec turns it on.
#
# Status → korner mapping is driven by the manifest's `feed_projection`
# block:
#   - `status_post_type` matches Status#post_type (Kommons)
#   - `status_association` names a `has_one` on Status that carries the
#     korner record (Kalendar, Booth, Albutts, …)
# A manifest that declares a post type is matched on that alone; the
# association is the fallback. A boost is judged by the post it boosts.
#
# Only the korners this account has tuned out of are checked, and their
# associations are preloaded for the whole page in one query each — not
# one query per status per korner.
#
# A Status that matches no korner projection isn't a korner card at all
# (it's a plain toot) — it always passes the gate.

module Kronk
  module TuneInGate
    module_function

    def filter(account, statuses)
      return statuses unless Kronk::FeatureFlags.enabled?(:tune_in_enforced)
      return statuses if account.nil?

      tuned_out_slugs = account.korner_tune_outs.pluck(:korner_slug).to_set
      return statuses if tuned_out_slugs.empty?

      manifests = Kronk::KornerRegistry.all.select { |m| tuned_out_slugs.include?(m.slug) }
      return statuses if manifests.empty?

      targets = statuses.map { |status| status.reblog || status }
      preload_associations(targets, manifests)

      statuses.reject { |status| manifests.any? { |m| projects?(m, status.reblog || status) } }
    end

    def projects?(manifest, status)
      if manifest.status_post_type.present?
        status.post_type.to_s == manifest.status_post_type.to_s
      else
        assoc = manifest.status_association
        assoc.present? && status.respond_to?(assoc) && status.public_send(assoc).present?
      end
    end

    def preload_associations(statuses, manifests)
      assocs = manifests
               .select { |m| m.status_post_type.blank? && m.status_association.present? }
               .map(&:status_association)
               .select { |assoc| Status.reflect_on_association(assoc) }
      return if assocs.empty? || statuses.empty?

      ActiveRecord::Associations::Preloader.new(records: statuses, associations: assocs).call
    end
  end
end
