# frozen_string_literal: true

module Status::Visibility
  extend ActiveSupport::Concern

  included do
    # Kronk `krew` visibility (5) — audience is the union of members of
    # the Krews this Status is attached to via `statuses_krews`. Local
    # only per KRONK_KREWS §3; skips federation + public/tag streams.
    #
    # Kronk reach ladder (docs/kronk_feed_and_reach.md §2) — three
    # distance tiers plus a self tier, all local-only:
    #   mates (6)     — the author's mutual connections (Account#mate?)
    #   orbit (7)     — mates of mates, one hop out (Account#orbit_of?)
    #   self_only (8) — the author's own timeline only; radiates to no one
    # Like `krew`, none are distributable, so they never federate or hit
    # the public/tag streams (see #distributable? and ActivityPub audience,
    # which yields an empty to/cc for any unmatched visibility).
    enum :visibility,
         { public: 0, unlisted: 1, private: 2, direct: 3, limited: 4, krew: 5, mates: 6, orbit: 7, self_only: 8 },
         suffix: :visibility,
         validate: true

    scope :distributable_visibility, -> { where(visibility: %i(public unlisted)) }
    scope :list_eligible_visibility, -> { where(visibility: %i(public unlisted private)) }
    scope :not_direct_visibility, -> { where.not(visibility: :direct) }

    validates :visibility, exclusion: { in: %w(direct limited krew mates orbit self_only) }, if: :reblog?

    before_validation :set_visibility, unless: :visibility?
  end

  class_methods do
    def selectable_visibilities
      # `krew` is selectable — the composer needs it — but `direct` +
      # `limited` still aren't. The visibility dropdown ordering + the
      # extra `krew_ids` payload requirement are enforced at the
      # controller / UI level.
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
