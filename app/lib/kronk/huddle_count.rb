# frozen_string_literal: true

# How many people are in the Main Huddle, from the Jitsi server's room-size
# endpoint (docs/spaces/huddle.md). Only a number, never who. The home
# feed's LiveBanner reads the remembered count through
# GET /api/v1/huddle/count rather than asking Jitsi itself.
#
# `fetch` asks Jitsi (nil when it can't say). `remember` / `last_seen` keep
# the latest count in Redis, so a "People are huddling" nudge can say how
# many are there now without storing a number on the nudge.
module Kronk
  module HuddleCount
    extend Redisable

    ROOM = 'huddle'
    LAST_SEEN_KEY = 'huddle:main:count'
    LAST_SEEN_TTL = 5.minutes

    def self.fetch
      url = "https://#{Rails.configuration.x.kronk_jitsi_domain}/room-size?room=#{ROOM}&domain=meet.jitsi"

      Request.new(:get, url).perform do |response|
        case response.code
        when 404 then 0 # Jitsi's answer for a room nobody is in
        when 200 then Integer(JSON.parse(response.body_with_limit)['participants'])
        end
      end
    rescue HTTP::Error, OpenSSL::SSL::SSLError, Mastodon::Error, JSON::ParserError, ArgumentError, TypeError => e
      Rails.logger.warn("Huddle count unavailable: #{e.class}: #{e.message}")
      nil
    end

    def self.remember(count)
      redis.set(LAST_SEEN_KEY, count, ex: LAST_SEEN_TTL.to_i)
    end

    # nil when nothing has been seen for a while (the watcher has stopped, or
    # Jitsi isn't answering): better to say nothing than an old number.
    def self.last_seen
      redis.get(LAST_SEEN_KEY)&.to_i
    end
  end
end
