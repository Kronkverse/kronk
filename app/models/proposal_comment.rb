# frozen_string_literal: true

# A comment on a Kommons proposal. Discussion for the support-model proposal
# page — this is the real comments store (the old "discussion" was vote
# responses, now retired). One level of threading: a comment may reply to
# another via `parent`.
class ProposalComment < ApplicationRecord
  belongs_to :proposal
  belongs_to :account
  belongs_to :parent, class_name: 'ProposalComment', optional: true, inverse_of: :replies

  has_many :replies, class_name: 'ProposalComment', foreign_key: :parent_id,
                     dependent: :destroy, inverse_of: :parent

  validates :body, presence: true, length: { maximum: 2_000 }
  validate :parent_on_same_proposal
  # One level of threading: a reply cannot itself be replied to.
  validate :parent_is_a_root

  scope :roots, -> { where(parent_id: nil) }
  scope :chronological, -> { order(:created_at) }

  # A new comment nudges the proposal author, and — on a reply — the parent
  # commenter too, via the korner event bus (`kommons.proposal.commented` →
  # Nudges, wired in the nudges manifest's `listens:` block). Mirrors
  # Favourite#publish_korner_froth: a synchronous in-process event. Self-nudges
  # (commenting on your own proposal / replying to yourself) and non-Mate
  # recipients are dropped downstream by Nudges::EventRouter.
  after_create :publish_korner_comment

  private

  def parent_on_same_proposal
    return if parent.nil?

    errors.add(:parent, 'must belong to the same proposal') if parent.proposal_id != proposal_id
  end

  def parent_is_a_root
    errors.add(:parent, 'cannot be a reply') if parent&.parent_id.present?
  end

  def publish_korner_comment
    # Proposal author + (on a reply) the parent commenter. De-dup so one
    # person never gets two nudges for the same comment, and skip the
    # commenter themselves.
    recipient_ids = [proposal.created_by_account_id, parent&.account_id].compact.uniq

    recipient_ids.each do |recipient_id|
      next if recipient_id == account_id

      Kronk::KornerEvents.publish(
        'kommons.proposal.commented',
        actor_account_id: account_id,
        recipient_account_id: recipient_id,
        proposal_id: proposal_id
      )
    end
  end
end
