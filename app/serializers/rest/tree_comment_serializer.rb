# frozen_string_literal: true

class REST::TreeCommentSerializer < ActiveModel::Serializer
  attributes :id, :node_id, :body, :created_at

  belongs_to :account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  def node_id
    object.node_id.to_s
  end
end
