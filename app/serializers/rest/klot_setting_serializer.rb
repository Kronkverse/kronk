# frozen_string_literal: true

class REST::KlotSettingSerializer < ActiveModel::Serializer
  attributes :cycle_length, :period_length, :updated_at
end
