# frozen_string_literal: true

# Kuestions v2 dedicated model. One answer per (question, account) —
# enforced by both the unique DB index and the model validation. When
# the parent Question is `locked?`, viewers who haven't answered can
# only see their own answer (via Kuestions::VisibilityGate).
#
# `choice_index` (Phase 1a — 2026-07-22) records the picked option for
# `mc` and `yn` questions. Free-text questions leave it nil and use
# `body` alone. For choice-based, `body` echoes the chosen label so
# federation + the legacy Status projection still read like sentences.
class Answer < ApplicationRecord
  belongs_to :question
  belongs_to :account
  belongs_to :status, class_name: 'Status', optional: true, inverse_of: :answer

  # Four-tier reach ladder (docs/kronk_feed_and_reach.md §2). The
  # answer picks its own scope per response; the tier names match the
  # Status/Album/Moment enums so a single vocabulary carries through
  # the whole platform.
  VISIBILITY_SCOPES = %w(public orbit mates self_only).freeze

  validates :body, presence: true
  validates :account_id, uniqueness: { scope: :question_id }
  validates :visibility_scope, inclusion: { in: VISIBILITY_SCOPES }
  validate  :choice_index_matches_format

  before_update :snapshot_prior_version
  after_commit  :publish_kuestions_question_answered, on: :create

  # Public-by-design edit trail per brief. Each entry is a hash:
  #   { "body" => "...", "choice_index" => n | nil, "edited_at" => ISO8601 }
  # The current values live on the row; edit_history holds the
  # supplanted versions in chronological order (oldest first).
  def edited?
    Array(edit_history).any?
  end

  private

  # Choice-based questions need an in-range index; free-text must not
  # carry one.
  def choice_index_matches_format
    return unless question

    if question.choice_based?
      errors.add(:choice_index, 'must be an in-range option index for a choice-based Kuestion') unless choice_index.is_a?(Integer) && choice_index.between?(0, question.mc_options.size - 1)
    elsif choice_index.present?
      errors.add(:choice_index, 'must be blank for a free-text Kuestion')
    end
  end

  # If body or choice_index is about to change, push the prior values
  # onto edit_history so the audit trail persists. `updated_at` isn't
  # yet set to Time.current here (that's Rails' concern), so we
  # timestamp explicitly with the pre-change updated_at — that's when
  # this row _was_ its former self.
  def snapshot_prior_version
    return unless body_changed? || choice_index_changed?

    prior = {
      'body' => body_was,
      'choice_index' => choice_index_was,
      'edited_at' => (updated_at || Time.current).iso8601,
    }
    self.edit_history = Array(edit_history) + [prior]
  end

  # kuestions.question.answered — someone answered a Question; Nudges
  # routes to the asker's Mate chat with the answerer (if Mates).
  def publish_kuestions_question_answered
    Kronk::KornerEvents.publish(
      'kuestions.question.answered',
      actor_account_id: account_id,
      recipient_account_id: question.created_by_account_id,
      question_id: question_id,
      answer_id: id
    )
  end
end
