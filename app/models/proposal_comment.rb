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

  private

  def parent_on_same_proposal
    return if parent.nil?

    errors.add(:parent, 'must belong to the same proposal') if parent.proposal_id != proposal_id
  end

  def parent_is_a_root
    errors.add(:parent, 'cannot be a reply') if parent&.parent_id.present?
  end
end
