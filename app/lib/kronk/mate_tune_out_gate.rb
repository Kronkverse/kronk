# frozen_string_literal: true

# Kronk — Mateship. Drops the posts a member has chosen not to see from one
# Mate: a korner's cards (their Booth sets, their events, …) or their plain
# posts (`posts`). Set on the Mateship page (decisions.md, 2026-11-20).
#
# Read-side, like Kronk::TuneInGate, and matched the same way (a post is a
# korner's card when that korner's `feed_projection` claims it). Unlike the
# tune-in gate it isn't behind a flag: it does nothing until someone turns
# something off, and then only for posts by that one Mate.
module Kronk
  module MateTuneOutGate
    module_function

    def filter(account, statuses)
      return statuses if account.nil? || statuses.empty?

      rows = MateTuneOut.where(account_id: account.id, target_account_id: statuses.map(&:account_id).uniq)
                        .pluck(:target_account_id, :korner_slug)
      return statuses if rows.empty?

      off = rows.group_by(&:first).transform_values { |pairs| pairs.to_set(&:last) }
      manifests = projecting_manifests
      Kronk::TuneInGate.preload_associations(statuses.select { |s| off.key?(s.account_id) }.map { |s| s.reblog || s }, manifests)

      statuses.reject do |status|
        slugs = off[status.account_id]
        next false if slugs.nil?

        slugs.include?(kind_of(status.reblog || status, manifests))
      end
    end

    # The korner that projects this post, or `posts` when none does.
    def kind_of(status, manifests = projecting_manifests)
      manifests.find { |m| Kronk::TuneInGate.projects?(m, status) }&.slug || MateTuneOut::PLAIN_POSTS
    end

    # Korners whose cards reach a feed: a post type, or an association that
    # Status really has.
    def projecting_manifests
      Kronk::KornerRegistry.all.reject(&:core?).select do |manifest|
        manifest.status_post_type.present? ||
          (manifest.status_association.present? && Status.reflect_on_association(manifest.status_association))
      end
    end
  end
end
