# frozen_string_literal: true

class REST::ProfileSectionSerializer < ActiveModel::Serializer
  attributes :id, :section_type, :position, :title, :settings, :visible

  def id
    object.id.to_s
  end
end
