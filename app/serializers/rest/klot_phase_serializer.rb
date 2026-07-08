# frozen_string_literal: true

# Public projection of a Klot account's cycle for viewers in the
# allowlist. Deliberately narrow — the underlying log is never exposed.
#
# Consumers get:
#   - The current phase key (menstrual / follicular / ovulatory / luteal)
#   - The moment the projection was computed
#   - The account id (so the client can render the person's name)
#
# What we DO NOT return: dates, day numbers, cycle length, period length,
# individual logged periods, or notes. This is a semantic guarantee of
# the sharing contract.
class REST::KlotPhaseSerializer < ActiveModel::Serializer
  attributes :account_id, :phase, :as_of

  def account_id
    object[:account_id].to_s
  end

  def phase
    object[:phase]
  end

  def as_of
    object[:as_of]
  end
end
