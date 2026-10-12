# frozen_string_literal: true

# A profile Kuestion pinned to a profile: the question and its owner's
# answer, flat, for the profile's Identity zone.
class REST::Kuestions::PinnedAnswerSerializer < ActiveModel::Serializer
  attributes :question_id, :title, :label, :seed_key, :answer_format,
             :body, :choice_index, :visibility_scope, :size, :position

  def question_id
    object.question_id.to_s
  end

  def title
    object.question.title
  end

  def label
    Kuestions::ProfileSeeds.entry_for(object.question.seed_key)&.fetch('label', nil)
  end

  def seed_key
    object.question.seed_key
  end

  def answer_format
    object.question.answer_format
  end

  def position
    object.pin_position
  end
end
