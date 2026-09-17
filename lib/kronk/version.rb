# frozen_string_literal: true

# Kronk's own version, layered on top of the upstream Mastodon version
# in lib/mastodon/version.rb. The Mastodon module version (4.5.9) stays
# tied to the upstream we're compatible with — federation and ActivityPub
# read that. The Kronk version below advances independently every time
# feature work merges to main.
#
# Conventions:
#   • patch (1.7.0 → 1.7.1) — bug fixes, refactors, doc-only changes
#   • minor (1.7.0 → 1.8.0) — new Korners, new subsystems, new features
#   • major (1.7.0 → 2.0.0) — paradigm shifts, breaking client changes
#
# History (retro-assigned when Kronk versioning was introduced):
#   1.0.0  Base Kronk fork + Huddle
#   1.1.0  Kommons (proposals + governance)
#   1.2.0  Kalendar (events + RSVPs)
#   1.3.0  Kuestions (question/answer paradigm on Status)
#   1.4.0  Booth (audio sets + share flow)
#   1.5.0  InFlow (observation feature)
#   1.6.0  Nudges (notification-style space)
#   1.7.0  Korner Framework — manifest system, boot validator, shared
#          card frame, transaction race fixes
#   2.0.0  Rebuild — Korner framework v2, planet metaphor retired,
#          Hub landing, Groups primitive, Nudges activity feed,
#          org space, sectioned profile, tune-in gate.
#
# The rebuild ships from the long-lived `rebuild/2.0.0` integration
# branch. It carries the static `2.0.0-alpha` milestone below; `main`
# stays on the 1.7.x line until the final PR flips the milestone.
#
# Decoupled from PRs (2026-07-30): this used to carry a hand-bumped
# `alpha.N` that every PR incremented, which collided constantly between
# concurrent PRs on the shared branch. It no longer does. A specific
# build is identified by its commit — appended from ENV below (the same
# `SOURCE_COMMIT` var Mastodon reads), and by the deployed git ref — not
# by a number anyone has to bump. So: PRs do NOT touch this file; only
# bump MILESTONE at a real milestone (e.g. when 2.0.0 ships).
#
# Bumped to 2.0.0 on 2026-09-16 (Phase 14.2) — the branch stops calling
# itself alpha before it is offered to `main`. Shadow reports it first,
# which is correct: shadow IS the release candidate.
module Kronk
  module Version
    module_function

    MILESTONE = '2.0.0'

    # Releases get a name, and 2.0 is Rose — after the gesture the rebuild
    # introduced: one tap on a Mate's profile, no message, gone by morning
    # (docs/spaces/rose.md). The name belongs to the release rather than
    # decorating it, so it rides in the version string, which is what
    # `/api/v1/instance` reports once the deploy stamps
    # MASTODON_VERSION_PRERELEASE from here.
    #
    # Safe to do because nothing compares this — only the korners CLI and
    # that deploy stamp read it. The update checker compares
    # Mastodon::Version, and only on major.minor.patch.
    RELEASE_NAME = 'Rose'
    RELEASE_SLUG = 'rose'

    def to_s
      commit = build_commit
      commit ? "#{number}+#{commit}" : number
    end

    # `2.0.0-rose` — the machine-facing string.
    def number
      RELEASE_SLUG.empty? ? MILESTONE : "#{MILESTONE}-#{RELEASE_SLUG}"
    end

    # `2.0.0 "Rose"` — for anywhere a person reads it.
    def full
      RELEASE_NAME.empty? ? MILESTONE : %(#{MILESTONE} "#{RELEASE_NAME}")
    end

    def to_a
      to_s.split(/[.+-]/).map { |part| Integer(part, exception: false) || part }
    end

    # Short commit of the deployed tree, from the env the deploy stamps
    # (`SOURCE_COMMIT`, which Mastodon already uses; `KRONK_BUILD` as an
    # alias). Nil in local dev / CI where neither is set — a bare
    # milestone is fine there.
    def build_commit
      commit = ENV['SOURCE_COMMIT'] || ENV.fetch('KRONK_BUILD', nil)
      # Plain Ruby (no ActiveSupport `blank?`): the deploy reads this via bare
      # `ruby -Ilib -r kronk/version` with Rails not loaded, so `blank?` raised
      # NoMethodError and aborted the version-label sync. to_s handles nil.
      commit = nil if commit.to_s.strip.empty?
      commit && commit[0, 8]
    end
  end
end
