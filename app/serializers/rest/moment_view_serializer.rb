# frozen_string_literal: true

class REST::MomentViewSerializer < ActiveModel::Serializer
  attribute :created_at, key: :viewed_at

  belongs_to :account, serializer: REST::AccountSerializer
end
