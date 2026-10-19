# frozen_string_literal: true

# Nudges::MuteCatalogue — the one list of nudge types a person can mute, and
# the one check every delivery path asks ("has this person muted this?").
# docs/spaces/nudges.md (Nudge settings).
#
# A row's key is what delivery actually produces, so a mute matches:
#
#   * Nudges (Nudges::EventRouter): `<source_korner>.<verb>`, taken from the
#     `listens:` block of config/korners/nudges.yaml plus the few places that
#     call the router directly (HAND_WIRED). A `verb_template` such as
#     `rsvpd_{status}` is ONE row keyed by the template; any filled-in verb
#     (`rsvpd_going`, `rsvpd_not_going`) matches it.
#   * Legacy notifications (NotifyService, Kronk::KornerNotifier): the
#     notification is mapped to the row it duplicates (a `favourite` on a
#     plain post is `feed.frothed`), or to a row of its own when no nudge
#     exists for it (LEGACY_ONLY). So muting froths silences the nudge, the
#     dual-running legacy notification and that notification's browser push.
#
# Keys saved before 2026-10-17 used bare notification types. The ones with an
# obvious new row are read as that row (OLD_KEYS); the rest no longer match
# anything and drop out the next time the person saves.
module Nudges
  module MuteCatalogue
    SETTING = 'nudges.muted_types'

    # Plain-English label for each row. `korner: nil` puts a row in the
    # "People" group of /settings/notifications; any other value groups it
    # under that korner (and shows it on /hub/<slug>/settings).
    ROWS = {
      'feed.frothed' => { korner: nil, label: 'Someone froths your post' },
      'feed.replied' => { korner: nil, label: 'Someone replies to your post' },
      'feed.mentioned' => { korner: nil, label: 'Someone mentions you' },
      'profile.posted_on' => { korner: nil, label: 'Someone posts on your profile' },
      'mates.mate_requested' => { korner: nil, label: 'Someone wants to be Mates' },
      'mates.mate_accepted' => { korner: nil, label: 'Someone becomes your Mate' },
      'media_tag' => { korner: nil, label: 'Someone tags you in a photo' },
      'poll' => { korner: nil, label: 'A poll you made or voted in ends' },
      'kommons.backed' => { korner: 'kommons', label: 'Someone backs your proposal' },
      'kommons.claimed' => { korner: 'kommons', label: 'Someone picks up your proposal' },
      'kommons.joined' => { korner: 'kommons', label: 'Someone joins you on a proposal' },
      'kommons.frothed' => { korner: 'kommons', label: 'Someone froths your proposal' },
      'kommons.commented' => { korner: 'kommons', label: 'Someone comments on your proposal' },
      'kommons.proposal_challenged' => { korner: 'kommons', label: 'Someone challenges your proposal' },
      'kommons.proposal_status_changed' => { korner: 'kommons', label: 'A proposal you made or backed moves on' },
      'kommons.task_assigned' => { korner: 'kommons', label: 'You are given a task' },
      'krew.join_requested' => { korner: 'krew', label: 'Someone asks to join your Krew' },
      'krew.join_accepted' => { korner: 'krew', label: 'You are let into a Krew' },
      'albutts.contribution_requested' => { korner: 'albutts', label: 'Someone asks to add photos to your album' },
      'albutts.contribution_granted' => { korner: 'albutts', label: 'You can now add photos to an album' },
      'albutts.added_photo' => { korner: 'albutts', label: 'Someone adds to an album you share' },
      'albutts.tagged' => { korner: 'albutts', label: 'Someone tags you in an album' },
      'kalendar.rsvpd_{status}' => { korner: 'kalendar', label: 'Someone answers the invite to your event' },
      'event_invitation' => { korner: 'kalendar', label: 'Someone invites you to an event' },
      'wachuneed.offered' => { korner: 'wachuneed', label: 'Someone makes an offer on your listing' },
      'wachuneed.offer_accepted' => { korner: 'wachuneed', label: 'Your offer is accepted' },
      'wachuneed.offer_declined' => { korner: 'wachuneed', label: 'Your offer is declined' },
      'freethedream.mentioned' => { korner: 'freethedream', label: 'Someone tags you in an emergence’s talk' },
      'freethedream.mycelium_matched' => { korner: 'freethedream', label: 'A new need fits something you shared from your Mycelium' },
      'kuestions.answered' => { korner: 'kuestions', label: 'Someone answers your question' },
      'kuestions.frothed' => { korner: 'kuestions', label: 'Someone froths your question' },
      'booth.frothed' => { korner: 'booth', label: 'Someone froths your set' },
      'booth.tagged' => { korner: 'booth', label: 'Someone credits you as an artist on a set' },
      'map.challenged' => { korner: 'map', label: 'A Mate thinks your pin on the Map is out of date' },
      'rose.received' => { korner: 'rose', label: 'A Mate sends you a rose' },
    }.freeze

    # Nudges delivered by calling Nudges::EventRouter directly rather than
    # through a `listens:` entry.
    HAND_WIRED = %w(
      albutts.added_photo
      albutts.tagged
      profile.posted_on
    ).freeze

    # Things delivered only as a legacy Notification (no nudge). The key is
    # the one they were saved under before, so existing mutes keep working.
    LEGACY_ONLY = %w(
      kommons.proposal_challenged
      kommons.proposal_status_changed
      kommons.task_assigned
      media_tag
      poll
      event_invitation
    ).freeze

    # A delivered `<korner>.<verb>` that is the same thing as another row.
    # FanOutOnWriteService routes a mention as `nudges.mention`, alongside
    # Kronk::StatusNudges' `feed.mentioned`.
    ALIASES = { 'nudges.mention' => 'feed.mentioned' }.freeze

    # Legacy notification type => row, for types that have one.
    LEGACY_TYPES = {
      'follow_request' => 'mates.mate_requested', # Mates::RequestService
      'follow' => 'mates.mate_accepted',          # Mates::AcceptService follows back
      'proposal_challenged' => 'kommons.proposal_challenged',
      'proposal_status_changed' => 'kommons.proposal_status_changed',
      'task_assigned' => 'kommons.task_assigned',
      'media_tag' => 'media_tag',
      'poll' => 'poll',
      'event_invitation' => 'event_invitation',
    }.freeze

    # Saved before 2026-10-17 => the row that now means the same thing.
    OLD_KEYS = {
      'favourite' => 'feed.frothed',
      'reply' => 'feed.replied',
      'mention' => 'feed.mentioned',
      'mate_request' => 'mates.mate_requested',
      'follow_request' => 'mates.mate_requested',
      'follow' => 'mates.mate_accepted',
    }.freeze

    module_function

    # Every row, People first, then each korner's rows by korner name.
    def rows(muted: Set.new)
      keys = (listen_keys + HAND_WIRED + LEGACY_ONLY).uniq
      keys.map { |key| row_for(key, muted) }
          .sort_by { |row| [row[:korner].nil? ? 0 : 1, row[:korner_name].to_s, keys.index(row[:key])] }
    end

    def keys
      rows.pluck(:key)
    end

    # The row keys this user has muted, with pre-2026-10-17 keys translated.
    def muted_keys(user)
      return [] if user.nil?

      Array(user.settings[SETTING]).map { |k| OLD_KEYS.fetch(k.to_s, k.to_s) }.uniq
    end

    # Has `account` muted nudges of this korner + verb?
    def muted?(account, korner:, verb:)
      muted = muted_keys(account&.user)
      return false if muted.empty?

      muted.include?(key_for(korner, verb))
    end

    # Has `account` muted this legacy notification? Takes the Notification
    # (to tell a froth on a proposal from a froth on a post) or a bare type.
    def notification_muted?(account, notification)
      muted = muted_keys(account&.user)
      return false if muted.empty?

      key = notification.is_a?(Notification) ? key_for_notification(notification) : LEGACY_TYPES[notification.to_s]
      key.present? && muted.include?(key)
    end

    # The row a nudge delivery belongs to.
    def key_for(korner, verb)
      key = "#{korner}.#{verb}"
      return ALIASES[key] if ALIASES.key?(key)
      return key if ROWS.key?(key) && !key.include?('{')

      listen_keys.find { |k| k.include?('{') && template_regex(k).match?(key) } || key
    end

    # The row a legacy notification belongs to, or nil if it has none.
    def key_for_notification(notification)
      type = notification.type.to_s
      status = notification.target_status

      case type
      when 'favourite'
        froth_key(status)
      when 'mention'
        status && status.in_reply_to_account_id == notification.account_id ? 'feed.replied' : 'feed.mentioned'
      else
        LEGACY_TYPES[type]
      end
    end

    # Mirrors Favourite#publish_korner_froth: a froth on a korner-owned post
    # is that korner's froth, anything else is a froth on a plain post.
    def froth_key(status)
      return 'booth.frothed' if status&.booth_set
      return 'kommons.frothed' if status.respond_to?(:proposal) && status.proposal
      return 'kuestions.frothed' if status.respond_to?(:question) && status.question

      'feed.frothed'
    end

    def listen_keys
      nudges = Kronk::KornerRegistry.find('nudges')
      return [] unless nudges

      nudges.listens.filter_map do |entry|
        next unless entry.is_a?(Hash) && entry['source_korner'].present?

        verb = entry['verb_template'].presence || entry['verb']
        next if verb.blank?

        ALIASES.fetch("#{entry['source_korner']}.#{verb}", "#{entry['source_korner']}.#{verb}")
      end
    end

    def template_regex(key)
      pattern = Regexp.escape(key).gsub(/\\\{\w+\\\}/, '[a-z0-9_]+')
      Regexp.new("\\A#{pattern}\\z")
    end

    def row_for(key, muted)
      meta = ROWS.fetch(key) { { korner: key.split('.').first, label: key.split('.').last.tr('_{}', ' ').strip.capitalize } }
      korner = meta[:korner]
      {
        key: key,
        korner: korner,
        korner_name: korner && (Kronk::KornerRegistry.find(korner)&.name || korner.capitalize),
        label: meta[:label],
        muted: muted.include?(key),
        interactive: interactive?(key),
      }
    end

    def interactive?(key)
      entry = Kronk::KornerRegistry.find('nudges')&.listens&.find do |e|
        e.is_a?(Hash) && "#{e['source_korner']}.#{e['verb_template'].presence || e['verb']}" == key
      end
      entry ? entry['interaction'] == 'interactive' : false
    end
  end
end
