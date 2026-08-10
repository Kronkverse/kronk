# frozen_string_literal: true

module Status::Visibility
  extend ActiveSupport::Concern

  included do
    # Kronk reach ladder (docs/kronk_feed_and_reach.md §2) — three
    # distance tiers plus a self tier, all local-only:
    #   mates (6)     — the author's mutual connections (Account#mate?)
    #   orbit (7)     — mates of mates, one hop out (Account#orbit_of?)
    #   self_only (8) — the author's own timeline only; radiates to no one
    # None are distributable, so they never federate or hit the public/tag
    # streams (see #distributable? and ActivityPub audience, which yields an
    # empty to/cc for any unmatched visibility).
    #
    # `krew` (was integer 5) is retired as a visibility value — krew is now
    # an orthogonal, additive audience axis carried by `statuses_krews`
    # (docs/rebuild/krew_axis_migration.md, 2026-08-10). A krew is targeted
    # independently of the reach tier; a member of any targeted krew sees the
    # status additively (StatusPolicy#show?, FanOutOnWriteService). The 5 slot
    # is left empty rather than renumbered (renumbering rewrites every row).
    enum :visibility,
         { public: 0, unlisted: 1, private: 2, direct: 3, limited: 4, mates: 6, orbit: 7, self_only: 8 },
         suffix: :visibility,
         validate: true

    scope :distributable_visibility, -> { where(visibility: %i(public unlisted)) }
    scope :list_eligible_visibility, -> { where(visibility: %i(public unlisted private)) }
    scope :not_direct_visibility, -> { where.not(visibility: :direct) }

    validates :visibility, exclusion: { in: %w(direct limited mates orbit self_only) }, if: :reblog?

    before_validation :set_visibility, unless: :visibility?
  end

  class_methods do
    def selectable_visibilities
      # The reach tiers (public/unlisted/mates/orbit/self_only) are
      # selectable; `direct` + `limited` aren't. Krew is no longer a
      # visibility — it's an additive axis picked separately alongside the
      # reach tier (see the enum note above).
      visibilities.keys - %w(direct limited)
    end
  end

  def hidden?
    !distributable?
  end

  def distributable?
    public_visibility? || unlisted_visibility?
  end

  alias sign? distributable?

  private

  def set_visibility
    self.visibility ||= reblog.visibility if reblog?
    self.visibility ||= visibility_from_account
  end

  def visibility_from_account
    account.locked? ? :private : :public
  end
end
