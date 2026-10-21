# frozen_string_literal: true

# Sends "People are huddling" to everyone whose number (`fomo_threshold` on
# /hub/huddle/settings) is in `reached`: the counts the Main Huddle has just
# passed. Called by Scheduler::HuddleFomoScheduler.
#
# The nudge has no actor: the Jitsi server gives a count, not who is there,
# and the nudge never says who. Skipped for anyone tuned out of Huddle or who
# turned the row off; the Push switch and quiet hours are Nudges::PushWorker's
# as for any nudge. People already in the Huddle get it too, since the server
# can't tell who they are (docs/spaces/huddle.md, Open).
class Huddle::FomoNotifier
  KORNER = 'huddle'
  VERB   = 'gathering'
  SETTING = 'fomo_threshold'
  DEFAULT_THRESHOLD = 1

  def initialize(reached:)
    @reached = reached
  end

  def call
    recipients.each { |account| notify(account) }
  end

  private

  def recipients
    thresholds = UserKornerSetting.where(korner_slug: KORNER).pluck(:user_id, :values).to_h
    tuned_out  = KornerTuneOut.where(korner_slug: KORNER).pluck(:account_id).to_set

    User.confirmed.approved.enabled.account_not_suspended.includes(:account).find_each.filter_map do |user|
      next if tuned_out.include?(user.account_id)
      next unless @reached.cover?(threshold_for(thresholds[user.id]))

      user.account
    end
  end

  def threshold_for(values)
    [Integer(values&.fetch(SETTING, nil) || DEFAULT_THRESHOLD, exception: false) || DEFAULT_THRESHOLD, 1].max
  end

  def notify(account)
    return if Nudges::MuteCatalogue.muted?(account, korner: KORNER, verb: VERB)

    # One at a time: an earlier gathering's nudge is over, like the Huddle.
    Nudges::Event.addressed_to(account).where(source_korner_slug: KORNER, verb: VERB).delete_all

    Nudges::Event.create!(
      actor_account: nil,
      recipient_account: account,
      source_korner_slug: KORNER,
      verb: VERB,
      source_type: main_huddle && 'HuddleSession',
      source_id: main_huddle&.id,
      interaction: 'interactive',
      cta_label: 'Join',
      cta_route: '/hub/huddle'
    )
  end

  def main_huddle
    return @main_huddle if defined?(@main_huddle)

    @main_huddle = HuddleSession.main_scope.first
  end
end
