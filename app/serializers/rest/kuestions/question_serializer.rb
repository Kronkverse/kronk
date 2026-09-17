# frozen_string_literal: true

# Kuestions v2 REST — the Question envelope. Answers are only
# serialised when `with_answers: true` is passed and the viewer has
# passed `Kuestions::VisibilityGate`. For choice-based, an
# `aggregate` block replaces per-answer detail (counts + voter
# avatars per option).
class REST::Kuestions::QuestionSerializer < ActiveModel::Serializer
  attributes :id, :title, :prompt, :answer_format, :mc_options,
             :locked, :answers_count, :created_at

  attribute :answered?, key: :has_answered

  belongs_to :account, key: :asker, serializer: REST::AccountSerializer

  attribute :answers,   if: :include_answers?
  attribute :aggregate, if: :include_aggregate?

  def id
    object.id.to_s
  end

  def account
    object.created_by_account
  end

  def answered?
    return false unless viewer

    object.answered_by?(viewer)
  end

  def answers_count
    @answers_count ||= object.answers.count
  end

  def created_at
    object.created_at.iso8601
  end

  def include_answers?
    return false unless with_answers?
    return false unless Kuestions::VisibilityGate.can_view_answers?(object, viewer)

    object.text_based?
  end

  def include_aggregate?
    return false unless with_answers?
    return false unless Kuestions::VisibilityGate.can_view_answers?(object, viewer)

    object.choice_based?
  end

  def answers
    Kuestions::VisibilityGate
      .visible_answers(object, viewer)
      .to_a
      .sort_by(&:created_at)
      .map { |a| REST::Kuestions::AnswerSerializer.new(a, scope: viewer).as_json }
  end

  # Choice-based aggregation: per-option counts + up to 5 voter
  # avatars. Only counts answers the viewer is allowed to see per
  # per-answer scope (so `only_me` voters never inflate a public
  # total; `connections`-scoped voters only count for Mates). The
  # answerer always sees their own vote.
  def aggregate
    visible = Kuestions::VisibilityGate.visible_answers(object, viewer)
    Array(object.mc_options).each_with_index.map do |option, idx|
      voters = visible.select { |a| a.choice_index == idx }
      {
        label: option.is_a?(Hash) ? option['label'] : option.to_s,
        count: voters.size,
        voters: voters.first(5).map do |a|
          {
            id: a.account_id.to_s,
            acct: a.account&.acct,
            display_name: a.account&.display_name,
            avatar: a.account&.avatar_original_url,
          }
        end,
      }
    end
  end

  private

  def viewer
    scope
  end

  def with_answers?
    instance_options[:with_answers] == true
  end
end
