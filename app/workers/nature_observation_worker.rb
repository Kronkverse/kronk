# frozen_string_literal: true

class NatureObservationWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'default', retry: 2, unique: :until_executed

  def perform(date_str)
    date = Date.parse(date_str)
    NatureObservationGenerator.generate!(date)
  end
end
