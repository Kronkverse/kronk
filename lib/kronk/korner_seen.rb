# frozen_string_literal: true

# Standardised per-korner "seen" plumbing — the single choke-point behind the
# unread badges on Hub tiles and the side nav. Every korner uses the same
# mechanism; per-korner specifics live only in the content-stream adapter
# (Kronk::KornerContentStreams), never here.
#
# Two pieces of state, both account-keyed and slug-scoped:
#   * KornerSeenMarker  — a per-korner baseline id. Everything at or below it is
#     seen wholesale (set when you open the korner).
#   * KornerContentView — per-item "seen" rows for items ABOVE the baseline
#     (set when you interact with one post without opening the korner).
#
# The unread count for a korner is: the korner's viewer-visible items with
# id > baseline, minus the per-item seen rows, minus the viewer's own posts.
# What "viewer-visible" means and how to enumerate a korner's items is the
# adapter's job.
module Kronk
  module KornerSeen
    module_function

    # Record that `account` has seen one specific item of `slug`. Idempotent
    # (ON CONFLICT DO NOTHING). No-op if the item is already covered by the
    # account's baseline. This is the per-post-precise clearing path used by
    # feed interactions (froth/reblog a korner post in your own feed).
    def mark_seen(account, slug, content_id)
      return if account.nil? || slug.blank? || content_id.nil?

      slug       = slug.to_s
      content_id = content_id.to_i
      return if content_id <= baseline_for(account, slug)

      KornerContentView.insert_all(
        [{ account_id: account.id, korner_slug: slug, content_id: content_id, created_at: Time.current }],
        unique_by: :index_korner_content_views_uniqueness
      )
    end

    # Mark the whole korner seen up to its newest item — called when the account
    # opens the korner. Advances the baseline and prunes the now-redundant
    # per-item rows so KornerContentView stays small.
    def mark_all_seen(account, slug)
      return if account.nil? || slug.blank?

      slug   = slug.to_s
      newest = KornerContentStreams.for(slug).newest_id(account)
      return if newest.nil? || newest <= 0

      marker = KornerSeenMarker.find_or_initialize_by(account_id: account.id, korner_slug: slug)
      return if marker.persisted? && marker.baseline_id >= newest

      marker.baseline_id = newest
      marker.save!

      account.korner_content_views
             .where(korner_slug: slug)
             .where(content_id: ..newest)
             .delete_all
    end

    # Unread count of viewer-visible new items for one korner.
    def unread_count(account, slug)
      counts_for(account, [slug]).fetch(slug.to_s, 0)
    end

    # Batched unread counts for several korners at once (one pass over the
    # marker + view tables, then one count per korner via its adapter). Powers
    # the /api/v1/korners index. Anonymous callers get an empty hash.
    def counts_for(account, slugs)
      return {} if account.nil?

      slugs = Array(slugs).map(&:to_s).uniq
      return {} if slugs.empty?

      baselines = KornerSeenMarker.where(account_id: account.id, korner_slug: slugs)
                                  .pluck(:korner_slug, :baseline_id).to_h
      seen = seen_ids_by_slug(account, slugs)

      slugs.index_with do |slug|
        KornerContentStreams.for(slug)
                            .unread_relation(account, baselines.fetch(slug, 0), seen[slug] || [])
                            .count
      end
    end

    def baseline_for(account, slug)
      KornerSeenMarker.where(account_id: account.id, korner_slug: slug.to_s).pick(:baseline_id) || 0
    end

    def seen_ids_by_slug(account, slugs)
      account.korner_content_views
             .where(korner_slug: slugs)
             .pluck(:korner_slug, :content_id)
             .each_with_object(Hash.new { |h, k| h[k] = [] }) { |(slug, id), acc| acc[slug] << id }
    end
  end
end
