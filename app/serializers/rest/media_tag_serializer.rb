# frozen_string_literal: true

class REST::MediaTagSerializer < ActiveModel::Serializer
  attributes :id, :account_id, :x, :y

  has_one :account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  def account_id
    object.account_id.to_s
  end
end
