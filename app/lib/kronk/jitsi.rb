# frozen_string_literal: true

require 'jwt'

# Kronk's Jitsi server, as configuration (config/initializers/1_kronk_jitsi.rb)
# and the pass that lets a member into a call (docs/decisions.md, 2026-10-27,
# "Kronk's own Jitsi").
#
# A pass is an HS256 JWT the server checks against the shared secret:
# `iss` the app id, `aud` "jitsi", `sub` the XMPP domain, `room` the one room
# it opens, `context.user` who it is and whether they moderate. Without
# JITSI_JWT_SECRET there are no passes and the client joins the old open
# server as it always did.
#
# Room names: every name Kronk hands Jitsi is `room_prefix + key`, where the
# key is what Kronk stores (`huddle`, a Kuddle's `session_url`, a live set's
# `room_key`). The prefix never reaches the database.
module Kronk
  module Jitsi
    MAIN_ROOM   = 'huddle'
    XMPP_DOMAIN = 'meet.jitsi'
    AUDIENCE    = 'jitsi'
    PASS_TTL    = 2.hours
    # Clocks drift; a pass is good from a minute before it was made.
    CLOCK_SKEW  = 1.minute

    module_function

    def domain
      Rails.configuration.x.kronk_jitsi_domain
    end

    def jwt_secret
      Rails.configuration.x.kronk_jitsi_jwt_secret.presence
    end

    def app_id
      Rails.configuration.x.kronk_jitsi_jwt_app_id.presence || 'kronk'
    end

    def room_prefix
      Rails.configuration.x.kronk_jitsi_room_prefix.to_s
    end

    def recording_secret
      Rails.configuration.x.kronk_jitsi_recording_secret.presence
    end

    def tokens?
      jwt_secret.present?
    end

    # Recording needs a server that knows who moderates (tokens), a way for
    # the recorder to reach Kronk (the HMAC secret) and somewhere private to
    # put the file (S3).
    def recording?
      tokens? && recording_secret.present? && Kronk::CallRecordingStorage.available?
    end

    def room_name(key)
      "#{room_prefix}#{key}"
    end

    # The stored key for a Jitsi room name, or nil when the name isn't one
    # of this Kronk's (another prefix: another Kronk on the same server).
    # Jitsi lowercases room names and may add the MUC domain.
    def room_key(name)
      name = name.to_s.strip.downcase.split('@').first.to_s
      prefix = room_prefix.downcase
      return nil if name.blank? || !name.start_with?(prefix)

      key = name.delete_prefix(prefix)
      key.presence
    end

    def pass(account:, room:, moderator:, avatar: nil, now: Time.current)
      return nil unless tokens?

      payload = {
        iss: app_id,
        aud: AUDIENCE,
        sub: XMPP_DOMAIN,
        room: room,
        iat: now.to_i,
        nbf: (now - CLOCK_SKEW).to_i,
        exp: (now + PASS_TTL).to_i,
        context: {
          user: {
            id: account.id.to_s,
            name: account.display_name.presence || account.username,
            avatar: avatar,
            moderator: moderator,
            affiliation: moderator ? 'owner' : 'member',
          }.compact,
        },
      }

      JWT.encode(payload, jwt_secret, 'HS256')
    end
  end
end
