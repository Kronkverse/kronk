# frozen_string_literal: true

class Scheduler::UserCleanupScheduler
  include Sidekiq::Worker

  DISCARDED_STATUSES_MAX_AGE_DAYS = 30

  sidekiq_options retry: 0, lock: :until_executed, lock_ttl: 1.day.to_i

  def perform
    # Kronk — the upstream "delete unconfirmed accounts after 7 days" sweep is
    # deliberately NOT run. Email confirmation is voluntary
    # (docs/rebuild/decisions.md 2026-08-16/19), so an unconfirmed account is a
    # real member, not an abandoned registration: purging it destroys a live
    # user (this hard-deleted @ladatal via delete_all on 2026-08-18, with no
    # trace). Signups are activated immediately now, so accounts shouldn't be
    # unconfirmed anyway — but we never auto-purge for it either way. Only the
    # discarded-status cleanup remains.
    clean_discarded_statuses!
  end

  private

  def clean_discarded_statuses!
    Status.unscoped.discarded.where(deleted_at: ..DISCARDED_STATUSES_MAX_AGE_DAYS.days.ago).find_in_batches do |statuses|
      RemovalWorker.push_bulk(statuses) do |status|
        [status.id, { 'immediate' => true, 'skip_streaming' => true }]
      end
    end
  end
end
