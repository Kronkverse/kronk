# frozen_string_literal: true

# Runs once daily via config/sidekiq.yml. Ensures a KosmicUpdate row
# exists for today, creating one if necessary. Idempotent: the unique
# `on_date` index prevents duplicates when the job runs late or is
# retried.
#
# Body defaults are placeholder text; the Inflow team can post custom
# text ahead of the scheduled run and this worker will notice and skip.
# Wiring the update into a Status projection lives on an accompanying
# service (Inflow::PublishKosmicUpdate) — this scheduler just ensures
# the row exists.
class Scheduler::KosmicDailyScheduler
  include Sidekiq::Worker

  sidekiq_options retry: 0

  DEFAULT_BODY = "Today's kosmic weather is unwritten."

  def perform
    date = Time.now.utc.to_date
    return if KosmicUpdate.exists?(on_date: date)

    KosmicUpdate.create!(
      on_date: date,
      body: DEFAULT_BODY,
      seasonal_context: {
        hemisphere_hint: 'northern',
        source: 'scheduler-placeholder',
      }
    )
  rescue ActiveRecord::RecordNotUnique
    # A concurrent insert beat us to it — that's fine, our job is done.
  end
end
