# frozen_string_literal: true

class REST::ProfileSectionSerializer < ActiveModel::Serializer
  attributes :id, :section_type, :position, :title, :settings, :visible, :visibility

  # Client copy calls these "shelves" and the two families
  # `told` / `drawn`. `kind` is an alias for `section_type` so the
  # frontend can read the vocabulary it uses in the UI without needing
  # to know the model column name.
  attribute :kind

  def id
    object.id.to_s
  end

  def kind
    object.section_type
  end
end
