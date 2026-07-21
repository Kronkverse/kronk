# frozen_string_literal: true

# == Schema Information
#
# Table name: favourites
#
#  id         :bigint(8)        not null, primary key
#  created_at :datetime         not null
#  updated_at :datetime         not null
#  account_id :bigint(8)        not null
#  status_id  :bigint(8)        not null
#

class Favourite < ApplicationRecord
  include Paginable
  include Favourite::FaspConcern

  update_index('statuses', :status)

  belongs_to :account, inverse_of: :favourites
  belongs_to :status,  inverse_of: :favourites

  has_one :notification, as: :activity, dependent: :destroy

  validates :status_id, uniqueness: { scope: :account_id }

  before_validation do
    self.status = status.reblog if status&.reblog?
  end

  after_create :increment_cache_counters
  after_create :publish_korner_froth
  after_destroy :decrement_cache_counters
  after_destroy :invalidate_cleanup_info

  private

  def increment_cache_counters
    status&.increment_count!(:favourites_count)
  end

  # Dispatches a korner-scoped froth event when the favourited Status
  # carries a korner-owned association (BoothSet, Proposal, Question).
  # Plain Favourites — where the Status has no such attachment —
  # short-circuit so the event bus stays quiet for ordinary likes.
  # Nudges then routes to the source-object owner's Mate chat with the
  # frother, subject to the mutual-follow Mates gate.
  def publish_korner_froth
    return unless status

    if status.booth_set
      Kronk::KornerEvents.publish(
        'booth.set.frothed',
        actor_account_id: account_id,
        recipient_account_id: status.account_id,
        booth_set_id: status.booth_set.id,
        status_id: status.id
      )
    elsif status.respond_to?(:proposal) && status.proposal
      Kronk::KornerEvents.publish(
        'kommons.proposal.frothed',
        actor_account_id: account_id,
        recipient_account_id: status.proposal.created_by_account_id,
        proposal_id: status.proposal.id,
        status_id: status.id
      )
    elsif status.respond_to?(:question) && status.question
      Kronk::KornerEvents.publish(
        'kuestions.question.frothed',
        actor_account_id: account_id,
        recipient_account_id: status.question.created_by_account_id,
        question_id: status.question.id,
        status_id: status.id
      )
    end
  end

  def decrement_cache_counters
    return if association(:status).loaded? && status.marked_for_destruction?

    status&.decrement_count!(:favourites_count)
  end

  def invalidate_cleanup_info
    return unless status&.account_id == account_id && account.local?

    account.statuses_cleanup_policy&.invalidate_last_inspected(status, :unfav)
  end
end
