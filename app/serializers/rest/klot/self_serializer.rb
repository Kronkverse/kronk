# frozen_string_literal: true

# REST::Klot::SelfSerializer — the owner's own cycle state.
#
# Only ever serialised for the owning account
# (Api::V1::Klot::SelfController). The viewer-facing projection is
# REST::Klot::ViewerSerializer + Api::V1::Klot::CircleController, which
# return strictly the phase and no numbers.
#
# `cycle_length` and `period_length` are worked out from the log
# (Kronk::CycleStats); `cycle_known` / `period_known` are false while a
# typical length is standing in for one.
class REST::Klot::SelfSerializer < ActiveModel::Serializer
  FIELDS = %i(
    day_of_cycle phase cycle_length cycle_known period_length period_known
    cycles_logged shortest_cycle longest_cycle bleeding
  ).freeze

  attributes(*FIELDS, :next_period, :logs)

  FIELDS.each do |field|
    define_method(field) { object[field] }
  end

  def next_period
    object[:next_period]&.transform_values { |value| value.respond_to?(:iso8601) ? value.iso8601 : value }
  end

  def logs
    Array(object[:logs]).map do |log|
      { id: log.id.to_s, started_on: log.started_on.iso8601, ended_on: log.ended_on&.iso8601, length: log.length }
    end
  end
end
