# frozen_string_literal: true

# Kuestions v2 REST — the Question envelope. Answers are only
# serialised when `with_answers: true` is passed and the viewer has
# passed `Kuestions::VisibilityGate`. For choice-based, an
# `aggregate` block replaces per-answer detail (counts + voter
# avatars per option).
class REST::Kuestions::QuestionSerializer < ActiveModel::Serializer
  attributes :id, :title, :prompt, :answer_format, :mc_options,
             :locked, :answers_count, :created_at, :kind, :seed_key

  attribute :answered?, key: :has_answered
  attribute :asked_by_me
  attribute :label, if: -> { object.seeded? }
  attribute :group, if: -> { object.seeded? }
  attribute :my_answer, if: :with_my_answer?

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

  def asked_by_me
    viewer.present? && object.created_by_account_id == viewer.id
  end

  # A Kronk-written Kuestion's short name and Profile-view heading.
  def label
    Kuestions::ProfileSeeds.entry_for(object.seed_key)&.fetch('label', nil)
  end

  def group
    Kuestions::ProfileSeeds.entry_for(object.seed_key)&.fetch('group', nil)
  end

  # The viewer's own answer, for lists of what they have answered. On a
  # profile Kuestion it also says whether it's pinned, its reach and size.
  def my_answer
    return unless viewer

    answer = object.answers.find_by(account_id: viewer.id)
    return unless answer

    mine = { body: answer.body, choice_index: answer.choice_index }
    return mine unless object.profile?

    mine.merge(pinned: answer.pinned?, visibility_scope: answer.visibility_scope, size: answer.size)
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

  # Public: AMS calls `if:` conditions with public_send.
  def with_my_answer?
    instance_options[:with_my_answer] == true
  end

  private

  def viewer
    scope
  end

  def with_answers?
    instance_options[:with_answers] == true
  end
end
