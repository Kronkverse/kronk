# frozen_string_literal: true

# Fomo noto (Kommons, 2026-10-21): once a minute, how many are in the Main
# Huddle, and in each Kuddle someone follows. When the count reaches
# someone's number (`fomo_threshold`, a Huddle setting, 1 by default) they
# get a "People are huddling" nudge, or for a Kuddle they follow, a nudge
# naming it (Kommons "Notification for additional Huddles", 2026-10-27).
#
# Once per gathering: Redis keeps the highest count already announced, so
# people dropping in and out don't fire it again. It resets once the room
# has been empty for REARM_AFTER, so a quick gap doesn't count as a new
# gathering. The same rule holds for each Kuddle, under its own keys.
#
# Kuddles are bounded: only open ones with a follower (Huddle::Follows),
# most recently active first, at most MAX_KUDDLES a minute, one Jitsi
# request each.
class Scheduler::HuddleFomoScheduler
  include Sidekiq::Worker
  include Redisable

  sidekiq_options retry: 0, lock: :until_executed, lock_ttl: 1.minute.to_i

  ANNOUNCED_KEY   = 'huddle:fomo:announced'
  EMPTY_SINCE_KEY = 'huddle:fomo:empty_since'
  REARM_AFTER     = 10.minutes

  MAX_KUDDLES     = 20
  # A Kuddle's keys go when nobody has looked for a day (it lost its
  # followers, or was retired); polling refreshes them.
  KUDDLE_KEYS_TTL = 1.day

  def perform
    watch_main
    watch_kuddles
  end

  def self.kuddle_keys(id)
    ["huddle:fomo:kuddle:#{id}:announced", "huddle:fomo:kuddle:#{id}:empty_since"]
  end

  private

  def watch_main
    count = Kronk::HuddleCount.fetch
    return if count.nil?

    Kronk::HuddleCount.remember(count)
    track(count, ANNOUNCED_KEY, EMPTY_SINCE_KEY) do |reached|
      Huddle::FomoNotifier.new(reached: reached).call
    end
  end

  def watch_kuddles
    Huddle::Follows.watched_rooms(limit: MAX_KUDDLES).each do |kuddle|
      count = Kronk::HuddleCount.fetch(kuddle.session_url)
      next if count.nil?

      Kronk::HuddleCount.remember_kuddle(kuddle.id, count)
      announced_key, empty_key = self.class.kuddle_keys(kuddle.id)
      track(count, announced_key, empty_key, ttl: KUDDLE_KEYS_TTL) do |reached|
        Huddle::FomoNotifier.new(reached: reached, kuddle: kuddle).call
      end
    end
  end

  def track(count, announced_key, empty_key, ttl: nil, &block)
    if count.zero?
      note_empty(announced_key, empty_key, ttl)
    else
      announce_up_to(count, announced_key, empty_key, ttl, &block)
    end
  end

  def note_empty(announced_key, empty_key, ttl)
    since = redis.get(empty_key)

    if since.nil?
      write(empty_key, Time.now.to_i, ttl)
    elsif Time.now.to_i - since.to_i >= REARM_AFTER.to_i
      redis.del(announced_key, empty_key)
    end
  end

  def announce_up_to(count, announced_key, empty_key, ttl)
    redis.del(empty_key)

    announced = redis.get(announced_key).to_i
    if count <= announced
      redis.expire(announced_key, ttl.to_i) if ttl
      return
    end

    write(announced_key, count, ttl)
    yield((announced + 1)..count)
  end

  def write(key, value, ttl)
    ttl ? redis.set(key, value, ex: ttl.to_i) : redis.set(key, value)
  end
end
