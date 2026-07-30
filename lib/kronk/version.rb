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
module Kronk
  module Version
    module_function

    MILESTONE = '2.0.0-alpha'

    def to_s
      commit = build_commit
      commit ? "#{MILESTONE}+#{commit}" : MILESTONE
    end

    def to_a
      to_s.split(/[.+-]/).map { |part| Integer(part, exception: false) || part }
    end

    # Short commit of the deployed tree, from the env the deploy stamps
    # (`SOURCE_COMMIT`, which Mastodon already uses; `KRONK_BUILD` as an
    # alias). Nil in local dev / CI where neither is set — a bare
    # milestone is fine there.
    def build_commit
      commit = ENV['SOURCE_COMMIT'] || ENV['KRONK_BUILD']
      commit = nil if commit.nil? || commit.empty?
      commit && commit[0, 8]
    end
  end
end
