# frozen_string_literal: true

# Fomo noto (Kommons, 2026-10-21): once a minute, how many are in the Main
# Huddle. When the count reaches someone's number (`fomo_threshold`, a
# Huddle setting, 1 by default) they get a "People are huddling" nudge.
#
# Once per gathering: Redis keeps the highest count already announced, so
# people dropping in and out don't fire it again. It resets once the Huddle
# has been empty for REARM_AFTER, so a quick gap doesn't count as a new
# gathering. Main Huddle only; Rooms aren't watched.
class Scheduler::HuddleFomoScheduler
  include Sidekiq::Worker
  include Redisable

  sidekiq_options retry: 0, lock: :until_executed, lock_ttl: 1.minute.to_i

  ANNOUNCED_KEY   = 'huddle:fomo:announced'
  EMPTY_SINCE_KEY = 'huddle:fomo:empty_since'
  REARM_AFTER     = 10.minutes

  def perform
    count = Kronk::HuddleCount.fetch
    return if count.nil?

    Kronk::HuddleCount.remember(count)
    count.zero? ? note_empty : announce_up_to(count)
  end

  private

  def note_empty
    since = redis.get(EMPTY_SINCE_KEY)

    if since.nil?
      redis.set(EMPTY_SINCE_KEY, Time.now.to_i)
    elsif Time.now.to_i - since.to_i >= REARM_AFTER.to_i
      redis.del(ANNOUNCED_KEY, EMPTY_SINCE_KEY)
    end
  end

  def announce_up_to(count)
    redis.del(EMPTY_SINCE_KEY)

    announced = redis.get(ANNOUNCED_KEY).to_i
    return if count <= announced

    redis.set(ANNOUNCED_KEY, count)
    Huddle::FomoNotifier.new(reached: (announced + 1)..count).call
  end
end
