# frozen_string_literal: true

# Creates an open topical Huddle Room (see docs/spaces/huddle.md §
# Three categories of Huddle). Anyone signed in can call this; the
# only gate is a plausible name. Rooms carry no icon: Kronk has no emoji,
# and a Room's tile wears the Huddle glyph (decisions.md, 2026-10-22).
#
#   HuddleRoom::CreateService.new.call(
#     account: current_account,
#     name: 'Coworking',
#     description: 'For focused co-work sessions.',
#     krew: krew # optional: Konnect the new Room to a Krew the account is in
#   )
#
# A Krew given here is linked (a `link` KornerAttachment huddle → krew, in
# the same transaction), not a gate: the Room stays open to everyone.
# Members-only Krew Huddles are not built (docs/spaces/huddle.md). The
# caller checks the account may link that Krew.
#
# Publishes `huddle.room.created` on success so Nudges / activity
# surfaces can hear the birth of a new hangout.
module HuddleRoom
  class CreateService < BaseService
    # Room names longer than this get truncated. Signal is roomy; a
    # long room name is noise in a list.
    NAME_MAX = 80
    DESCRIPTION_MAX = 200

    def call(account:, name:, description: nil, krew: nil)
      raise ArgumentError, 'account is required' if account.nil?

      name = normalise(name, NAME_MAX)
      raise ArgumentError, 'name is required' if name.blank?

      session = HuddleSession.transaction do
        room = HuddleSession.create!(
          scope: 'room',
          title: name,
          description: normalise(description, DESCRIPTION_MAX),
          host_account: account,
          session_url: build_room_key(name),
          state: 'live',
          last_active_at: Time.current
        )
        Kronk::AttachmentEffects.link!('huddle', room.id, 'krew', krew.id, account) if krew
        room
      end

      Kronk::KornerEvents.publish(
        'huddle.room.created',
        huddle_session_id: session.id,
        actor_account_id: account.id,
        title: session.title
      )

      session
    end

    private

    def normalise(value, max)
      return nil if value.nil?

      trimmed = value.to_s.strip
      return nil if trimmed.empty?

      trimmed[0, max]
    end

    # Jitsi room name = the session_url field. Slug-ish: lowercase,
    # dashes for whitespace, keep alphanum + dash + a stable random
    # suffix so two "Coworking" rooms don't collide on the Jitsi side.
    # (Name-uniqueness at the display level is deliberately not
    # enforced — see docs/spaces/huddle.md § Open.)
    def build_room_key(name)
      slug = name.downcase.gsub(/[^a-z0-9]+/, '-').gsub(/(?:^-|-$)/, '')
      slug = 'room' if slug.blank?
      "#{slug}-#{SecureRandom.hex(4)}"
    end
  end
end
