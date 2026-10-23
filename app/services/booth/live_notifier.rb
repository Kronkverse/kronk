# frozen_string_literal: true

# "Someone is live in the Booth": a nudge to everyone tuned in to the Booth
# when a musician goes live (docs/spaces/booth.md, Live sets), the way
# Huddle::FomoNotifier tells people the Huddle is gathering. Skipped for the
# host, anyone tuned out of the Booth and anyone who turned the row
# (booth.went_live) off, except people who tapped Remind me on this set:
# they asked. Push follows the row's Push switch and quiet hours like any
# nudge (Nudges::PushWorker). When the set ends, `withdraw` takes
# its nudges back, so nobody is sent to a room that has closed.
class Booth::LiveNotifier
  KORNER = 'booth'
  VERB = 'went_live'

  def initialize(booth_live)
    @booth_live = booth_live
  end

  def call
    return unless @booth_live.live?

    recipients.each { |account| notify(account) }
  end

  def withdraw
    Nudges::Event.where(source_korner_slug: KORNER, verb: VERB, source_type: 'BoothLive', source_id: @booth_live.id).delete_all
  end

  private

  def recipients
    tuned_out = KornerTuneOut.where(korner_slug: KORNER).pluck(:account_id).to_set

    User.confirmed.approved.enabled.account_not_suspended.includes(:account).find_each.filter_map do |user|
      next if user.account_id == @booth_live.account_id
      next if tuned_out.include?(user.account_id) && !reminded.include?(user.account_id)

      user.account
    end
  end

  def reminded
    @reminded ||= @booth_live.reminders.pluck(:account_id).to_set
  end

  def notify(account)
    return if !reminded.include?(account.id) && Nudges::MuteCatalogue.muted?(account, korner: KORNER, verb: VERB)

    Nudges::Event.create!(
      actor_account: @booth_live.account,
      recipient_account: account,
      source_korner_slug: KORNER,
      verb: VERB,
      source_type: 'BoothLive',
      source_id: @booth_live.id,
      interaction: 'interactive',
      cta_label: 'Listen in',
      cta_route: "/hub/booth/live/#{@booth_live.id}"
    )
  end
end
