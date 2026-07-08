# frozen_string_literal: true

class REST::TreeNodeSerializer < ActiveModel::Serializer
  attributes :id, :parent_id, :kind, :name, :description,
             :status, :priority, :framework, :steps, :position,
             :created_at, :updated_at

  def id
    object.id.to_s
  end

  def parent_id
    object.parent_id&.to_s
  end
end
