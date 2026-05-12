# frozen_string_literal: true

class Proposal < ApplicationRecord
  CATEGORY_VALUES = %w(timeline huddle events marketplace identity moderation infrastructure app design governance).freeze

  belongs_to :created_by_account, class_name: 'Account'
  belongs_to :parent_proposal, class_name: 'Proposal', optional: true
  belongs_to :discussion_status, class_name: 'Status', optional: true, inverse_of: :proposal
  has_many :child_proposals, class_name: 'Proposal', foreign_key: :parent_proposal_id, dependent: :nullify, inverse_of: :parent_proposal
  has_many :proposal_votes, dependent: :destroy
  has_many :tasks, dependent: :destroy
  has_many :budget_items, dependent: :destroy

  enum :status, { open: 1, vetoed: 2, delivered: 3, in_progress: 4 }
  enum :proposal_type, { small: 0, medium: 1, large: 2 }, prefix: :type

  validates :title, presence: true, length: { maximum: 240 }
  validates :body,  presence: true
  validate  :categories_within_allowed_values

  scope :active,        -> { where(archived_at: nil) }
  scope :archived,      -> { where.not(archived_at: nil) }
  scope :recent,        -> { order(created_at: :desc) }
  scope :most_supported, lambda {
    left_joins(:proposal_votes)
      .select("proposals.*, COUNT(CASE WHEN proposal_votes.position = #{ProposalVote.positions[:agree]} THEN 1 END) AS agree_count")
      .group('proposals.id')
      .order(Arel.sql('agree_count DESC, proposals.created_at DESC'))
  }
  scope :most_discussed, lambda {
    left_joins(:proposal_votes)
      .select('proposals.*, COUNT(proposal_votes.id) AS total_votes')
      .group('proposals.id')
      .order(Arel.sql('total_votes DESC, proposals.created_at DESC'))
  }
  scope :with_category, ->(cat) { where('? = ANY(categories)', cat) }

  def archived?
    archived_at.present?
  end

  def participation_count
    proposal_votes.count
  end

  def support_count
    proposal_votes.where(position: :agree).count
  end

  def veto_count
    proposal_votes.where(position: :block).count
  end

  def vetoed_by_votes?
    proposal_votes.exists?(position: :block)
  end

  private

  def categories_within_allowed_values
    return if categories.blank?

    invalid = categories - CATEGORY_VALUES
    errors.add(:categories, "contains invalid values: #{invalid.join(', ')}") if invalid.any?
  end
end
