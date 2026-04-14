# frozen_string_literal: true

class ProposalCloseWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'default', retry: 3

  def perform
    Proposal.open.where('closes_at <= ?', Time.now.utc).find_each do |proposal|
      outcome = proposal.blocked? ? :blocked : :approved
      proposal.update!(
        status: :closed,
        outcome: outcome,
        outcome_notes: 'Automatically closed at deadline.'
      )
    end
  end
end
