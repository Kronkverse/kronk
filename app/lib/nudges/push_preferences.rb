# frozen_string_literal: true

# Nudges::PushPreferences — which nudges reach a person's phone.
# docs/spaces/nudges.md (Push).
#
# Push is chosen per row, beside "show in Nudges": the rows are the mute
# rows (Nudges::MuteCatalogue) plus two for chat messages. A row is pushed
# unless the person turned it off; a row muted in Nudges is never pushed,
# because it is never delivered. Stored as the list of rows turned off, so
# a row added later is pushed by default, like every other.
module Nudges
  module PushPreferences
    SETTING = 'nudges.push_off_types'

    MESSAGE_ROWS = {
      'messages.mate' => 'A Mate sends you a message',
      'messages.krew' => 'Someone writes in a Krew chat',
    }.freeze

    module_function

    def keys
      MESSAGE_ROWS.keys + Nudges::MuteCatalogue.keys
    end

    def off_keys(user)
      return [] if user.nil?

      Array(user.settings[SETTING]).map(&:to_s).uniq
    end

    # Does this person want `key` (a mute row or a message row) on their phone?
    def push?(user, key)
      return false if user.nil?

      !off_keys(user).include?(key)
    end

    def message_rows(user)
      off = off_keys(user)
      MESSAGE_ROWS.map { |key, label| { key: key, label: label, push: !off.include?(key) } }
    end

    # A legacy Notification also pushes on its own (NotifyService). Skip that
    # push when the nudge it duplicates pushes instead (froths, replies,
    # mentions, Mate requests), or when the person turned its row off.
    # Notifications with no row (moderation, admin) push as before.
    def skip_legacy_push?(account, notification)
      key = Nudges::MuteCatalogue.key_for_notification(notification)
      return false if key.nil?
      return true unless push?(account.user, key)

      nudge_delivered?(key)
    end

    def nudge_delivered?(key)
      return false if Nudges::MuteCatalogue::LEGACY_ONLY.include?(key)
      # Kronk::StatusNudges sends these only with the flag on.
      return Kronk::FeatureFlags.enabled?(:status_nudges) if key.start_with?('feed.')

      true
    end
  end
end
