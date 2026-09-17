# frozen_string_literal: true

module Kronk
  # The three thresholds — the ceremonial membership statement crossed
  # between account creation and entering Kronk. See KRONK_SIGNUP.md §2
  # and §6 for the canonical vow copy (in `config/locales/en.yml` under
  # `kronk.thresholds`).
  #
  # `CURRENT_VERSION` bumps only when a *vow line* changes materially.
  # A body-copy edit inside "Tell me more" is not a material change and
  # does not force existing members to re-cross. Members with
  # `users.thresholds_version < CURRENT_VERSION` re-cross on next
  # sign-in.
  module Thresholds
    # 2 (2026-09-17): all three vow lines rewritten at launch.
    # 3 (2026-09-17): the trajectory vow reworded again. Someone had
    # already crossed at 2 by then, so this bumps rather than editing
    # under them — same reason as the first bump. Two members re-cross.
    CURRENT_VERSION = 3

    KEYS = %i(ownership custodianship trajectory).freeze
  end
end
