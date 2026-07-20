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
# branch. Interim tips are marked `2.0.0-alpha.N`; `main` stays on the
# 1.7.x line until the final PR flips the version and merges.
module Kronk
  module Version
    module_function

    def to_s
      '2.0.0-alpha.90'
    end

    def to_a
      to_s.split(/[.-]/).map { |part| Integer(part, exception: false) || part }
    end
  end
end
