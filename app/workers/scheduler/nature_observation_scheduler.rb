# frozen_string_literal: true

class Scheduler::NatureObservationScheduler
  include Sidekiq::Worker

  sidekiq_options retry: 0, lock: :until_executed, lock_ttl: 1.hour.to_i

  def perform
    date = Time.now.in_time_zone('Australia/Melbourne').to_date
    NatureObservationGenerator.generate!(date)
  end
end
