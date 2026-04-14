# frozen_string_literal: true

class Proposal < ApplicationRecord
  belongs_to :created_by_account, class_name: 'Account'
  has_many :proposal_votes, dependent: :destroy
  has_many :tasks, dependent: :destroy
  has_many :budget_items, dependent: :destroy

  enum :status, { draft: 0, open: 1, closed: 2 }
  enum :decision_type, { consent: 0, majority: 1 }
  enum :outcome, { approved: 0, blocked: 1, lapsed: 2 }, prefix: :outcome

  validates :title, presence: true, length: { maximum: 240 }
  validates :body, presence: true

  scope :active, -> { where(status: :open).where('closes_at > ?', Time.now.utc) }
  scope :recent, -> { order(created_at: :desc) }

  def participation_count
    proposal_votes.count
  end

  def blocks
    proposal_votes.where(position: :block)
  end

  def blocked?
    blocks.exists?
  end
end
