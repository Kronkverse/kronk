# frozen_string_literal: true

# KrewRequirement — a join gate evaluated at join attempt when the
# Krew's `access` is `requirement_gated`. ANDed across rows per
# KRONK_KREWS §3 — a joiner must satisfy every requirement. The
# `kind` picks which of the other columns carries the constraint:
#
#   attending_event   — `event_id` (a Kalendar event the joiner must
#                       already RSVP for)
#   located_in        — `region` (a coarse place identifier — no
#                       precise coordinates; Map coarsening
#                       applies)
#   vouched_by_member — `vouch_params` (jsonb — provisional shape;
#                       Anthemos-backed and feature-flagged until DIDs
#                       land)
#
# Rows are additive; there is no "OR" between requirements.
class KrewRequirement < ApplicationRecord
  KINDS = %w(attending_event located_in vouched_by_member).freeze

  belongs_to :krew
  belongs_to :event, optional: true

  validates :kind, inclusion: { in: KINDS }
  validate  :kind_carries_expected_data

  private

  # A row's `kind` selects which of event_id / region / vouch_params
  # is expected. Guardrails make invalid rows obvious at write time.
  def kind_carries_expected_data
    case kind
    when 'attending_event'
      errors.add(:event_id, 'is required for attending_event') if event_id.blank?
    when 'located_in'
      errors.add(:region, 'is required for located_in') if region.blank?
    when 'vouched_by_member'
      errors.add(:vouch_params, 'is required for vouched_by_member') if vouch_params.blank?
    end
  end
end
