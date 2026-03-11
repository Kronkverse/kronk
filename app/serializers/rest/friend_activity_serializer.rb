# frozen_string_literal: true

class REST::FriendActivitySerializer < ActiveModel::Serializer
  attributes :id, :type, :created_at

  belongs_to :account, serializer: REST::AccountSerializer
  belongs_to :status, serializer: REST::StatusSerializer

  def type
    object.activity_type
  end
end
