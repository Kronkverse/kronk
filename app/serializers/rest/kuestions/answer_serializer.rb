# frozen_string_literal: true

# Kuestions v2 REST — individual Answer (used in text-format reveal).
# For choice-based Kuestions the per-answer detail is not directly
# exposed; the aggregate block on Question owns that.
class REST::Kuestions::AnswerSerializer < ActiveModel::Serializer
  attributes :id, :body, :choice_index, :visibility_scope,
             :mine, :edited, :edit_history, :created_at, :updated_at

  belongs_to :account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  def mine
    viewer && viewer.id == object.account_id
  end

  def edited
    object.edited?
  end

  def edit_history
    Array(object.edit_history).map do |entry|
      {
        body: entry['body'],
        choice_index: entry['choice_index'],
        edited_at: entry['edited_at'],
      }
    end
  end

  def created_at
    object.created_at.iso8601
  end

  def updated_at
    object.updated_at.iso8601
  end

  private

  def viewer
    scope
  end
end
