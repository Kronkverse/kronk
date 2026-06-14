# frozen_string_literal: true

class MomentReactionNotifyWorker
  include Sidekiq::Worker

  def perform(target_account_id, source_account_id, status_id)
    target_account = Account.find(target_account_id)
    source_account = Account.find(source_account_id)
    status         = Status.find(status_id)

    reaction = MomentReaction.find_by(status: status, account: source_account, emoji: 'heart')
    return unless reaction

    NotifyService.new.call(target_account, :moment_reaction, reaction)
  rescue ActiveRecord::RecordNotFound
    # status/account deleted
  end
end
