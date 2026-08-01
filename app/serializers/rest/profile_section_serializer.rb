# frozen_string_literal: true

class REST::ProfileSectionSerializer < ActiveModel::Serializer
  attributes :id, :section_type, :position, :title, :settings, :visible, :visibility

  # Client copy calls these "shelves"; the model column stays
  # `section_type` so we don't churn code. `kind` is an alias so the
  # frontend can read the vocabulary it uses in the UI.
  attribute :kind

  def id
    object.id.to_s
  end

  def kind
    object.section_type
  end
end
