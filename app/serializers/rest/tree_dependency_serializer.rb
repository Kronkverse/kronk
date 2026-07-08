# frozen_string_literal: true

class REST::TreeDependencySerializer < ActiveModel::Serializer
  attributes :id, :from_node_id, :to_node_id, :kind, :created_at

  def id
    object.id.to_s
  end

  def from_node_id
    object.from_node_id.to_s
  end

  def to_node_id
    object.to_node_id.to_s
  end
end
