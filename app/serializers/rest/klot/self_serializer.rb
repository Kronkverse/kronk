# frozen_string_literal: true

# Owner-facing self state. `object` is a Hash returned by
# Api::V1::Klot::SelfController#self_state — the calculator has
# already run, so we just project the fields. `logs` is a collection
# of CycleLog records (serialized inline as {id, started_on}).
class REST::Klot::SelfSerializer < ActiveModel::Serializer
  attributes :day_of_cycle, :phase, :cycle_length, :period_length, :logs

  def day_of_cycle
    object[:day_of_cycle]
  end

  def phase
    object[:phase]
  end

  def cycle_length
    object[:cycle_length]
  end

  def period_length
    object[:period_length]
  end

  # Newest-first array of {id, started_on}. Kept lean — the log is the
  # owner's ledger, not a general-purpose record.
  def logs
    Array(object[:logs]).map do |log|
      { id: log.id.to_s, started_on: log.started_on.iso8601 }
    end
  end
end
