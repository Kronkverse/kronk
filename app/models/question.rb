# frozen_string_literal: true

# Kuestions v2 dedicated model. A Question carries its own body and,
# optionally, a linked Status for feed projection. When `locked?` is
# true, Kuestions::VisibilityGate hides other-account answers from
# viewers who haven't answered themselves.
#
# `answer_format` (Phase 1a — 2026-07-22) controls how people
# respond. `text` is free-form; `mc` and `yn` are choice-based.
# `mc_options` is `[{"label" => "..."}, ...]` with 2–4 entries for
# `mc`; auto-populated to Yes/No when `answer_format = 'yn'`.
class Question < ApplicationRecord
  ANSWER_FORMATS = %w(text mc yn).freeze
  MC_OPTION_MIN  = 2
  MC_OPTION_MAX  = 4

  belongs_to :created_by_account, class_name: 'Account'
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :question
  has_many   :answers, dependent: :destroy
  has_many   :question_skips, dependent: :destroy

  validates :title, presence: true, length: { maximum: 240 }
  validates :answer_format, inclusion: { in: ANSWER_FORMATS }
  validate  :mc_options_shape

  before_validation :normalize_mc_options, on: :create

  scope :active,   -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  scope :locked_only, -> { where(locked: true) }

  # Deck: active Kuestions minus (a) the account's own asks, (b) any
  # they've already answered, (c) any they've skipped. Newest first.
  scope :deck_for, lambda { |account|
    return active.order(id: :desc) if account.nil?

    active
      .where.not(created_by_account_id: account.id)
      .where.not(id: Answer.where(account_id: account.id).select(:question_id))
      .where.not(id: QuestionSkip.where(account_id: account.id).select(:question_id))
      .order(id: :desc)
  }

  def archived?
    archived_at.present?
  end

  def answered_by?(account)
    return false if account.nil?

    answers.exists?(account_id: account.id)
  end

  def choice_based?
    ['mc', 'yn'].include?(answer_format)
  end

  def text_based?
    answer_format == 'text'
  end

  private

  def normalize_mc_options
    case answer_format
    when 'yn'
      # yes/no is a fixed shape — always store the two labels so
      # aggregation code doesn't need a special case.
      self.mc_options = [{ 'label' => 'Yes' }, { 'label' => 'No' }] if mc_options.blank?
    when 'text'
      # Text kuestions carry no options.
      self.mc_options = []
    end
  end

  def mc_options_shape
    if answer_format == 'mc'
      count = Array(mc_options).size
      errors.add(:mc_options, "must have between #{MC_OPTION_MIN} and #{MC_OPTION_MAX} options") unless count.between?(MC_OPTION_MIN, MC_OPTION_MAX)
      errors.add(:mc_options, 'each option must carry a label') if Array(mc_options).any? { |o| o.is_a?(Hash) && o['label'].to_s.strip.empty? }
    elsif answer_format == 'text' && Array(mc_options).any?
      errors.add(:mc_options, 'must be empty for text kuestions')
    end
  end
end
