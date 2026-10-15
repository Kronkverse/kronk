# frozen_string_literal: true

class REST::KrewJoinRequestSerializer < ActiveModel::Serializer
  attributes :id, :created_at

  belongs_to :account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end
end
