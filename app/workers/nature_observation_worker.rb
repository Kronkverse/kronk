# frozen_string_literal: true

class NatureObservationWorker
  include Sidekiq::Worker

  # `lock:` is sidekiq-unique-jobs' option (`unique:` did nothing), so a page
  # asking for a note that isn't ready queues one job, not one per visit.
  sidekiq_options queue: 'default', retry: 2, lock: :until_executed, lock_ttl: 1.hour.to_i

  def perform(date_str)
    date = Date.parse(date_str)
    return if NatureObservationGenerator.fetch(date)

    NatureObservationGenerator.generate!(date)
  end
end
