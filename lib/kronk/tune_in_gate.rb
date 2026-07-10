# frozen_string_literal: true

# Filters a batch of Statuses down to those the given account is tuned
# in to see, per spec §8.4.2 (the tune-in gate on the home timeline).
#
# Gated behind Kronk::FeatureFlags.enabled?(:tune_in_enforced). Until
# the flag flips to true (planned for Phase 14 of the 2.0.0 rebuild),
# `.filter` returns the input unchanged — no behavioural change lands
# in the read path.
#
# Status → korner mapping is driven by the manifest's `feed_projection`
# block:
#   - `status_post_type` matches Status#post_type (Kommons, Kuestions)
#   - `status_association` names a `has_one` on Status that carries the
#     korner record (Kalendar, Booth once linkage lands)
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

      statuses.reject { |status| tuned_out?(status, tuned_out_slugs) }
    end

    def tuned_out?(status, tuned_out_slugs)
      slug = status_korner_slug(status)
      slug && tuned_out_slugs.include?(slug)
    end

    def status_korner_slug(status)
      by_post_type = Kronk::KornerRegistry.all.find do |m|
        m.status_post_type.present? && status.post_type.to_s == m.status_post_type.to_s
      end
      return by_post_type.slug if by_post_type

      by_association = Kronk::KornerRegistry.all.find do |m|
        assoc = m.status_association
        assoc.present? && status.respond_to?(assoc) && status.public_send(assoc).present?
      end
      by_association&.slug
    end
  end
end
