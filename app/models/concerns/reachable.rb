# frozen_string_literal: true

# Reachable — shared audience logic for korner content whose reach is the
# platform ladder (public / mates / orbit / self_only) PLUS an orthogonal,
# ADDITIVE krew axis: members of any krew the item targets see it regardless of
# its reach tier (docs/kronk_feed_and_reach.md §2; krew orthogonal-axis
# migration 2026-08-10). Extracted so the visibility RULE lives in one place —
# Moment and Album share it, and a future korner post-type gets correct
# visibility by including this + supplying the small adapter below.
#
# An including model must:
#   * declare `enum :visibility` (any prefix/suffix) with at least the four
#     reach values `public / mates / orbit / self_only`;
#   * implement the adapter — the owner column/accessors and the krew hooks:
#       def reachable_owner_id            # the author account id
#       def reachable_owner               # the author account
#       def reachable_krew_member?(viewer) # is viewer in a krew this targets?
#       def self.reachable_owner_column   # :account_id / :owner_id
#       def self.reachable_krew_scope(krew_ids) # items targeting any krew_ids
#
# Reach semantics: mates = mutual follows of the owner; orbit = mates +
# mates-of-mates; public = everyone; self_only = owner only. Krew is additive
# and independent of the tier. Distinct from ProfileVisibility (no krew,
# members-only "public") — profile content speaks its own dialect.
module Reachable
  extend ActiveSupport::Concern

  # Is this item visible to `viewer` (nil = logged-out)? Owner always sees it.
  def visible_to?(viewer)
    return true if viewer && viewer.id == reachable_owner_id
    return true if reachable_krew_member?(viewer) # additive krew

    case visibility
    when 'public' then true
    when 'mates'  then reachable_mate?(viewer)
    when 'orbit'  then reachable_orbit?(viewer)
    else false # self_only — owner-only, already handled above
    end
  end

  private

  def reachable_mate?(viewer)
    viewer.present? && viewer.mates.exists?(id: reachable_owner_id)
  end

  def reachable_orbit?(viewer)
    return false if viewer.nil?

    reachable_mate?(viewer) || viewer.orbit_of?(reachable_owner)
  end

  class_methods do
    # Items visible to `viewer`, as a chainable relation. Reach tiers via the
    # owner column + follow graph; krew additively via the model's krew scope.
    def visible_to(viewer)
      col = reachable_owner_column
      return where(visibility: :public) if viewer.nil?

      mate_ids       = viewer.mates.select(:id)
      mates_of_mates = Account.where(id: Follow.where(account_id: mate_ids).select(:target_account_id))
                              .where(id: Follow.where(target_account_id: mate_ids).select(:account_id))
                              .where.not(id: viewer.id)
                              .select(:id)

      where(col => viewer.id)
        .or(where(visibility: :public))
        .or(where(visibility: :mates).where(col => mate_ids))
        .or(where(visibility: :orbit).where(col => mates_of_mates))
        .or(reachable_krew_scope(viewer.krews.select(:id)))
    end
  end
end
