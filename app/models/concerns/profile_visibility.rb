# frozen_string_literal: true

# Shared per-surface visibility for profile identity content (ProfileCard +
# ProfileSection). As of 2026-08-10 profile content speaks the platform reach
# ladder (docs/kronk_feed_and_reach.md §2), same as every other composer, in
# place of the old identity-scope ladder (everyone/kronk/connections/vouched/
# only_me). See docs/rebuild/decisions.md 2026-08-09.
#
# Reach semantics:
#   public     Kronkverse — any signed-in Kronk member. NOT the logged-out
#              web / fediverse (narrowed from the old `everyone`, 2026-08-10).
#   mates      mutual follows
#   orbit      mates + mates-of-mates
#   self_only  owner only
module ProfileVisibility
  extend ActiveSupport::Concern

  # Old identity-scope values → reach ladder, applied on write so a client
  # that hasn't migrated to the new vocabulary keeps working during the
  # transition. everyone/kronk collapse to Kronkverse (public — a narrowing
  # for `everyone`); connections/vouched to mates (vouched already resolved to
  # the connections gate); only_me to self_only.
  LEGACY_VISIBILITY_MAP = {
    'everyone' => 'public',
    'kronk' => 'public',
    'connections' => 'mates',
    'vouched' => 'mates',
    'only_me' => 'self_only',
  }.freeze

  included do
    # Non-contiguous integers deliberately match the Moment/Album reach enum
    # (public:0, mates:1, orbit:3, self_only:4) minus krew:2, so the ladder is
    # numerically uniform across models.
    enum :visibility, { public: 0, mates: 1, orbit: 3, self_only: 4 }, prefix: true
  end

  class_methods do
    # Translate a legacy identity-scope value to its reach-ladder equivalent;
    # a value already on the ladder passes through unchanged.
    def normalize_visibility(value)
      key = value.to_s
      LEGACY_VISIBILITY_MAP.fetch(key, key)
    end
  end

  # Is this row visible to `viewer` (a local Account, or nil for a logged-out
  # visitor)? The owner always sees their own content.
  def visible_to?(viewer)
    return true if viewer && viewer.id == account_id

    case visibility
    when 'public'
      # Kronkverse = signed-in Kronk members (local). Not remote/fediverse
      # viewers — matches the old `kronk` gate the widest tier collapsed from.
      viewer.present? && viewer.local?
    when 'mates'
      viewer.present? && mutual_follow?(viewer)
    when 'orbit'
      viewer.present? && (mutual_follow?(viewer) || viewer.orbit_of?(account))
    else # self_only — owner-only, already handled above
      false
    end
  end

  private

  def mutual_follow?(viewer)
    Follow.exists?(account_id: account_id, target_account_id: viewer.id) &&
      Follow.exists?(account_id: viewer.id, target_account_id: account_id)
  end
end
