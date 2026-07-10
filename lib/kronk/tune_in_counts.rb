# frozen_string_literal: true

# Aggregate tune-in counts per korner — how many accounts are currently
# tuned in to each korner. Powers the default Hub grid ordering
# ("most-tuned-in first"; see spec §4.7.1).
#
# Implementation: Rails.cache-backed (Redis) with a 5-minute TTL. On
# cache miss, does two counts + one aggregation join in Ruby. Deliberately
# NOT a materialised view — Kronk's account count sits in the thousands,
# not millions, so the simplicity of an in-Ruby aggregation wins over the
# operational overhead of `REFRESH MATERIALIZED VIEW` cron plumbing.
#
# When account count grows past ~1M, revisit — the aggregation becomes
# a full scan of `korner_tune_outs` per refresh.

module Kronk
  module TuneInCounts
    CACHE_KEY = 'kronk:tune_in_counts'
    CACHE_TTL = 5.minutes

    module_function

    def for_all_korners
      Rails.cache.fetch(CACHE_KEY, expires_in: CACHE_TTL) { compute }
    end

    def for_korner(slug)
      for_all_korners.fetch(slug.to_s, 0)
    end

    def refresh!
      Rails.cache.delete(CACHE_KEY)
      for_all_korners
    end

    def compute
      total = Account.local.count
      tune_outs = KornerTuneOut.group(:korner_slug).count

      Kronk::KornerRegistry.all.each_with_object({}) do |manifest, hash|
        hash[manifest.slug] = total - (tune_outs[manifest.slug] || 0)
      end
    end
  end
end
