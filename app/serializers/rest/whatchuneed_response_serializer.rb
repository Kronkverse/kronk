# frozen_string_literal: true

class REST::WhatchuneedResponseSerializer < ActiveModel::Serializer
  attributes :id, :body, :created_at

  belongs_to :account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end
end
