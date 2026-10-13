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

  # Four-tier reach ladder (docs/spaces/feed.md (The reach ladder)). The
  # answer picks its own scope per response; the tier names match the
  # Status/Album/Moment enums so a single vocabulary carries through
  # the whole platform.
  VISIBILITY_SCOPES = %w(public orbit mates self_only).freeze

  # The DB column still defaults to the legacy "connections" value that predates
  # the public/orbit/mates/self_only vocabulary — which fails the inclusion
  # validation below. Pin the Rails-level default to a valid scope ("mates", the
  # rename of "connections") so an answer created without an explicit scope still
  # saves; real answers set their scope per the responder's choice.
  attribute :visibility_scope, :string, default: 'mates'

  TILE_SIZES = %w(s m l xl).freeze
  BODY_LIMIT = 4000
  DATE_FORMAT = /\A\d{4}-\d{2}-\d{2}\z/

  validates :body, presence: true, length: { maximum: BODY_LIMIT }
  validates :account_id, uniqueness: { scope: :question_id }
  validates :visibility_scope, inclusion: { in: VISIBILITY_SCOPES }
  validate  :choice_index_matches_format
  validate  :body_matches_format

  # Pinned to the author's profile (profile Kuestions only), in
  # `pin_position` order. `settings['size']` is the tile size.
  scope :pinned, -> { where.not(pinned_at: nil).order(:pin_position, :pinned_at) }
  # Answers to the `birthday` profile Kuestion — what Kalendar and the
  # birthday nudge read.
  scope :birthdays, -> { joins(:question).where(questions: { seed_key: 'birthday' }) }

  before_update :snapshot_prior_version
  after_commit  :publish_kuestions_question_answered, on: :create, if: -> { question.community? }

  # Public-by-design edit trail per brief. Each entry is a hash:
  #   { "body" => "...", "choice_index" => n | nil, "edited_at" => ISO8601 }
  # The current values live on the row; edit_history holds the
  # supplanted versions in chronological order (oldest first).
  def edited?
    Array(edit_history).any?
  end

  def pinned?
    pinned_at.present?
  end

  def pin!
    return if pinned?

    next_position = Answer.where(account_id: account_id).where.not(pinned_at: nil).maximum(:pin_position).to_i + 1
    update!(pinned_at: Time.current, pin_position: next_position)
  end

  def unpin!
    update!(pinned_at: nil, pin_position: nil)
  end

  def size
    settings['size'] if TILE_SIZES.include?(settings['size'])
  end

  # Can `viewer` see this answer on its author's profile? The author always
  # can. Anyone else needs the profile itself to be visible to them and the
  # answer pinned, then the answer's own reach decides, on the same ladder
  # as the rest of the profile (ProfileVisibility).
  def visible_on_profile_to?(viewer)
    return true if viewer && viewer.id == account_id
    return false unless pinned? && account.profile_visible_to?(viewer)

    ProfileVisibility.reach_allows?(visibility_scope, owner: account, viewer: viewer)
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

  # Lists, links and dates are typed answers; the profile reads them.
  def body_matches_format
    return unless question && body.present?

    case question.answer_format
    when 'date'
      errors.add(:body, 'must be a date (YYYY-MM-DD)') unless DATE_FORMAT.match?(body) && Date.iso8601(body)
    when 'link'
      errors.add(:body, 'must be a link') if body.match?(/\s/)
    end
  rescue Date::Error
    errors.add(:body, 'must be a date (YYYY-MM-DD)')
  end

  # If body or choice_index is about to change, push the prior values
  # onto edit_history so the audit trail persists. `updated_at` isn't
  # yet set to Time.current here (that's Rails' concern), so we
  # timestamp explicitly with the pre-change updated_at — that's when
  # this row _was_ its former self.
  # Profile answers keep no trail: they are edited like a profile, and an
  # old location or status shouldn't stay readable.
  def snapshot_prior_version
    return if question.profile?
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
