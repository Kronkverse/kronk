# frozen_string_literal: true

# How many people are in the Main Huddle, or in a Kuddle, from the Jitsi
# server's room-size endpoint (docs/spaces/huddle.md). Only a number, never
# who. The home feed's LiveBanner reads the remembered Main count through
# GET /api/v1/huddle/count rather than asking Jitsi itself.
#
# `fetch` asks Jitsi (nil when it can't say); a Kuddle is asked by its Jitsi
# room key (`session_url`). The key is what Kronk stores; the name asked
# about carries JITSI_ROOM_PREFIX (Kronk::Jitsi.room_name). `remember` / `last_seen` keep the latest Main
# count in Redis, and `remember_kuddle` / `last_seen_kuddles` each Kuddle's,
# so a "People are huddling" nudge can say how many are there now without
# storing a number on the nudge.
module Kronk
  module HuddleCount
    extend Redisable

    ROOM = Kronk::Jitsi::MAIN_ROOM
    LAST_SEEN_KEY = 'huddle:main:count'
    LAST_SEEN_TTL = 5.minutes

    def self.fetch(room = ROOM)
      name = Kronk::Jitsi.room_name(room)
      url = "https://#{Kronk::Jitsi.domain}/room-size?room=#{CGI.escape(name)}&domain=#{Kronk::Jitsi::XMPP_DOMAIN}"

      Request.new(:get, url).perform do |response|
        case response.code
        when 404 then 0 # Jitsi's answer for a room nobody is in
        when 200 then Integer(JSON.parse(response.body_with_limit)['participants'])
        end
      end
    rescue HTTP::Error, OpenSSL::SSL::SSLError, Mastodon::Error, JSON::ParserError, ArgumentError, TypeError => e
      Rails.logger.warn("Huddle count unavailable for #{room}: #{e.class}: #{e.message}")
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

    def self.remember_kuddle(id, count)
      redis.set(kuddle_key(id), count, ex: LAST_SEEN_TTL.to_i)
    end

    # { id => count } for the Kuddles seen lately; the rest are left out.
    def self.last_seen_kuddles(ids)
      ids = Array(ids)
      return {} if ids.empty?

      ids.zip(redis.mget(*ids.map { |id| kuddle_key(id) })).each_with_object({}) do |(id, count), seen|
        seen[id] = count.to_i unless count.nil?
      end
    end

    def self.kuddle_key(id)
      "huddle:kuddle:#{id}:count"
    end
  end
end
