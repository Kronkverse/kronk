# frozen_string_literal: true

# Huddle korner split backfill. Walks Event rows with
# event_type='huddle' and creates matching HuddleSession rows carrying
# the huddle-specific fields (huddle_url → session_url, start_time →
# scheduled_start, end_time → scheduled_end, account_id →
# host_account_id). The parent Event gets events.huddle_session_id
# populated so Kalendar → Huddle linkage lands cleanly.
#
# Idempotent — skips Events whose linked HuddleSession already exists.
# Supports dry-run.
#
# Usage:
#   RAILS_ENV=production bundle exec rake kronk:huddle:backfill
#   RAILS_ENV=production DRY_RUN=1 bundle exec rake kronk:huddle:backfill
#
# The Event.event_type enum still carries the 'huddle' value at the end
# of this task — removing it and dropping the huddle_url column comes
# in a follow-up migration once every deploy target has been backfilled
# and the frontend routes have been swept.

namespace :kronk do
  namespace :huddle do
    desc 'Backfill HuddleSession rows from Event.event_type=huddle rows'
    task backfill: :environment do
      dry_run = ENV['DRY_RUN'] == '1'
      report  = { created: 0, linked: 0, skipped_existing: 0, skipped_invalid: 0 }
      log     = ->(m) { puts "[kronk:huddle:backfill] #{m}" }

      log.call("starting (dry_run=#{dry_run})")

      Event.where(event_type: :huddle).find_each do |event|
        if event.huddle_session_id.present? && HuddleSession.exists?(id: event.huddle_session_id)
          report[:skipped_existing] += 1
          next
        end

        session_url = event.respond_to?(:huddle_url) ? event.huddle_url.to_s : ''

        if session_url.blank?
          log.call("skipping Event(id=#{event.id}) — huddle_url is blank")
          report[:skipped_invalid] += 1
          next
        end

        attrs = {
          title: event.title,
          description: event.description,
          host_account_id: event.account_id,
          status_id: event.status_id,
          session_url: session_url,
          scheduled_start: event.start_time,
          scheduled_end: event.end_time,
          state: event_state_at(event),
          created_at: event.created_at,
          updated_at: event.updated_at,
        }

        if dry_run
          log.call("would create HuddleSession + link Event(id=#{event.id}) title=#{event.title.inspect}")
        else
          ActiveRecord::Base.transaction do
            session = HuddleSession.create!(attrs)
            event.update_columns(huddle_session_id: session.id)
          end
        end

        report[:created] += 1
        report[:linked] += 1
      end

      puts ''
      puts "HuddleSessions created:              #{report[:created]}"
      puts "Events linked (huddle_session_id):   #{report[:linked]}"
      puts "Skipped (already backfilled):        #{report[:skipped_existing]}"
      puts "Skipped (invalid — no huddle_url):   #{report[:skipped_invalid]}"
      puts ''
      puts dry_run ? 'DRY RUN — no rows written.' : 'Backfill complete.'
      puts ''
      puts 'Follow-up: once every deploy target has run this task,'
      puts 'drop the huddle enum value from Event.event_type and drop'
      puts 'the events.huddle_url column via a follow-up migration.'
    end

    # A huddle Event whose end_time has passed is 'ended'; a huddle
    # that's inside its scheduled window is 'live'; a huddle with a
    # future start_time is 'scheduled'; a huddle with neither is
    # 'draft'. Best-effort inference — the state field on
    # HuddleSession is authoritative from here on.
    def event_state_at(event)
      now = Time.now.utc
      return 'ended'     if event.end_time.present? && event.end_time < now
      return 'live'      if event.start_time.present? && event.start_time <= now && (event.end_time.nil? || event.end_time >= now)
      return 'scheduled' if event.start_time.present? && event.start_time > now

      'draft'
    end
  end
end
