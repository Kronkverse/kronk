# frozen_string_literal: true

# Sends "People are huddling" to everyone whose number (`fomo_threshold` on
# /hub/huddle/settings) is in `reached`: the counts the Main Huddle has just
# passed. Called by Scheduler::HuddleFomoScheduler.
#
# Given a `kuddle:`, the same for that Kuddle (a Huddle Room), to its
# followers only (Huddle::Follows): "People are in a Kuddle you follow",
# its row naming it. Same number, same switches; its own row
# (huddle.kuddle_gathering) turns it off.
#
# The nudge has no actor: the Jitsi server gives a count, not who is there,
# and the nudge never says who. Skipped for anyone tuned out of Huddle or who
# turned the row off; the Push switch and quiet hours are Nudges::PushWorker's
# as for any nudge. People already in the room get it too, since the server
# can't tell who they are (docs/spaces/huddle.md, Open): someone alone in a
# Kuddle they follow, at the default of 1, is told about themselves.
class Huddle::FomoNotifier
  KORNER = 'huddle'
  VERB   = 'gathering'
  KUDDLE_VERB = 'kuddle_gathering'
  SETTING = 'fomo_threshold'
  DEFAULT_THRESHOLD = 1

  def initialize(reached:, kuddle: nil)
    @reached = reached
    @kuddle  = kuddle
  end

  def call
    recipients.each { |account| notify(account) }
  end

  private

  def recipients
    thresholds = UserKornerSetting.where(korner_slug: KORNER).pluck(:user_id, :values).to_h
    tuned_out  = KornerTuneOut.where(korner_slug: KORNER).pluck(:account_id).to_set

    candidates.includes(:account).find_each.filter_map do |user|
      next if tuned_out.include?(user.account_id)
      next unless @reached.cover?(threshold_for(thresholds[user.id]))

      user.account
    end
  end

  def candidates
    users = User.confirmed.approved.enabled.account_not_suspended
    @kuddle ? users.where(account_id: Huddle::Follows.follower_ids(@kuddle)) : users
  end

  def threshold_for(values)
    [Integer(values&.fetch(SETTING, nil) || DEFAULT_THRESHOLD, exception: false) || DEFAULT_THRESHOLD, 1].max
  end

  def verb
    @kuddle ? KUDDLE_VERB : VERB
  end

  def notify(account)
    return if Nudges::MuteCatalogue.muted?(account, korner: KORNER, verb: verb)

    # One at a time: an earlier gathering's nudge is over, like the Huddle.
    # For a Kuddle, only that Kuddle's: others may still be going.
    earlier = Nudges::Event.addressed_to(account).where(source_korner_slug: KORNER, verb: verb)
    earlier = earlier.where(source_type: 'HuddleSession', source_id: @kuddle.id) if @kuddle
    earlier.delete_all

    Nudges::Event.create!(
      actor_account: nil,
      recipient_account: account,
      source_korner_slug: KORNER,
      verb: verb,
      source_type: source && 'HuddleSession',
      source_id: source&.id,
      interaction: 'interactive',
      cta_label: 'Join',
      cta_route: @kuddle ? "/hub/huddle/kuddle/#{@kuddle.id}" : '/hub/huddle'
    )
  end

  def source
    @kuddle || main_huddle
  end

  def main_huddle
    return @main_huddle if defined?(@main_huddle)

    @main_huddle = HuddleSession.main_scope.first
  end
end
