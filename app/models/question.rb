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
#
# `kind` (2026-10-12): `community` Kuestions are the Deck. `profile`
# Kuestions are answered and pinned to your profile; they are unlocked,
# stay out of the Deck and make no feed post. A profile Kuestion with a
# `seed_key` is Kronk-written (Kuestions::ProfileSeeds) and has no author.
# Profile Kuestions also take the longtext, list, link and date formats.
class Question < ApplicationRecord
  include Kronk::AttachmentSource

  self.attachment_source_slug = 'kuestions'

  KINDS = %w(community profile).freeze
  COMMUNITY_FORMATS = %w(text mc yn).freeze
  ANSWER_FORMATS = (COMMUNITY_FORMATS + %w(longtext list link date)).freeze
  CHOICE_FORMATS = %w(mc yn).freeze
  MC_OPTION_MIN  = 2
  MC_OPTION_MAX  = 4

  belongs_to :created_by_account, class_name: 'Account', optional: true
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :question
  has_many   :answers, dependent: :destroy
  has_many   :question_skips, dependent: :destroy

  validates :title, presence: true, length: { maximum: 240 }
  validates :answer_format, inclusion: { in: ANSWER_FORMATS }
  validates :answer_format, inclusion: { in: COMMUNITY_FORMATS }, if: :community?
  validates :kind, inclusion: { in: KINDS }
  validates :created_by_account, presence: true, unless: :seeded?
  validate  :mc_options_shape

  before_validation :normalize_mc_options, on: :create

  scope :active,   -> { where(archived_at: nil) }
  scope :archived, -> { where.not(archived_at: nil) }
  scope :locked_only, -> { where(locked: true) }
  scope :community, -> { where(kind: 'community') }
  scope :profile,   -> { where(kind: 'profile') }

  # Deck: active Kuestions minus (a) any the account has already
  # answered, (b) any they've skipped. Newest first. The asker's own
  # asks are NOT excluded — they surface in the caller's deck until the
  # caller either answers or skips them, so the asker can weigh in on
  # their own kuestion (their answer counts toward the aggregate).
  scope :deck_for, lambda { |account|
    return active.community.order(id: :desc) if account.nil?

    active
      .community
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

  def community?
    kind == 'community'
  end

  def profile?
    kind == 'profile'
  end

  def seeded?
    seed_key.present?
  end

  def choice_based?
    CHOICE_FORMATS.include?(answer_format)
  end

  # Everything that isn't a choice is answered in words: text, longtext,
  # list, link and date all list their answers rather than aggregate them.
  def text_based?
    !choice_based?
  end

  private

  def normalize_mc_options
    if answer_format == 'yn'
      # yes/no is a fixed shape — always store the two labels so
      # aggregation code doesn't need a special case.
      self.mc_options = [{ 'label' => 'Yes' }, { 'label' => 'No' }] if mc_options.blank?
    elsif !choice_based?
      # Only choice kuestions carry options.
      self.mc_options = []
    end
  end

  def mc_options_shape
    if answer_format == 'mc'
      count = Array(mc_options).size
      errors.add(:mc_options, "must have between #{MC_OPTION_MIN} and #{MC_OPTION_MAX} options") unless count.between?(MC_OPTION_MIN, MC_OPTION_MAX)
      errors.add(:mc_options, 'each option must carry a label') if Array(mc_options).any? { |o| o.is_a?(Hash) && o['label'].to_s.strip.empty? }
    elsif !choice_based? && Array(mc_options).any?
      errors.add(:mc_options, 'must be empty for kuestions without choices')
    end
  end
end
