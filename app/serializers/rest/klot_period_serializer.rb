# frozen_string_literal: true

# Owner-only view of a logged period.
class REST::KlotPeriodSerializer < ActiveModel::Serializer
  attributes :id, :started_on, :created_at

  def id
    object.id.to_s
  end
end
