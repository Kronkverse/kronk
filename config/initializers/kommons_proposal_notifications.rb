# frozen_string_literal: true

# Wire replies to proposal discussion statuses through NotifyService so
# the proposal creator sees "@x commented on your proposal" in their
# notifications feed. Skips self-replies (creator responding on their
# own thread).
Rails.application.config.to_prepare do
  Status.class_eval do
    after_create_commit :notify_proposal_creator_of_reply

    def notify_proposal_creator_of_reply
      return if in_reply_to_id.blank?

      proposal = Proposal.find_by(discussion_status_id: in_reply_to_id)
      return if proposal.blank?
      return if account_id == proposal.created_by_account_id

      NotifyService.new.call(proposal.created_by_account, :proposal_comment, self)
    rescue StandardError => e
      Rails.logger.warn("proposal_comment notification failed for status #{id}: #{e.class}: #{e.message}")
    end
  end
end
