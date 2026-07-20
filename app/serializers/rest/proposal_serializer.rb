# frozen_string_literal: true

class REST::ProposalSerializer < ActiveModel::Serializer
  attributes :id, :title, :body, :summary, :status, :node_id,
             :proposal_type, :categories,
             :parent_proposal_id, :status_id, :discussion_status_id,
             :outcome_notes, :opens_at,
             :support_count, :challenge_count, :participation_count,
             :created_at, :archived_at

  def parent_proposal_id
    object.parent_proposal_id&.to_s
  end

  def status_id
    object.status_id&.to_s
  end

  # Deprecated — mirrors status_id. Kept for one release so external
  # clients that read discussion_status_id continue to resolve.
  def discussion_status_id
    object.discussion_status_id&.to_s
  end

  attribute :current_vote do
    vote = object.proposal_votes.find_by(account: current_user&.account)
    vote ? { position: vote.position, title: vote.title, statement: vote.statement } : nil
  end

  attribute :vote_summary do
    {
      agree: object.proposal_votes.where(position: :agree).count,
      abstain: object.proposal_votes.where(position: :abstain).count,
      block: object.proposal_votes.where(position: :block).count,
    }
  end

  attribute :task_summary do
    {
      open: object.tasks.where(status: :open).count,
      in_progress: object.tasks.where(status: :in_progress).count,
      done: object.tasks.where(status: :done).count,
    }
  end

  attribute :budget_total do
    object.budget_items.sum(:cost_estimate).to_f
  end

  # Token backing: the proposal's total staked, distinct backer count, the
  # viewer's own stake, the viewer's spendable balance, and whether backing is
  # still open. `my_balance` is nil for a signed-out viewer.
  attribute :backing do
    account_id = current_user&.account&.id
    {
      total: object.backing_total,
      backers: ProposalBacking.backer_totals(object.id).size,
      my_stake: account_id ? ProposalBacking.stake_of(object.id, account_id) : 0,
      my_balance: account_id ? (TokenBalance.find_by(account_id: account_id)&.balance || 0) : nil,
      open: Kronk::ProposalStates.backable?(object),
    }
  end

  attribute :voters do
    object.proposal_votes.includes(:account).order(created_at: :desc).map do |v|
      {
        id: v.id.to_s,
        position: v.position,
        title: v.title,
        statement: v.statement,
        created_at: v.created_at,
        account: ActiveModelSerializers::SerializableResource.new(
          v.account, serializer: REST::AccountSerializer
        ).as_json,
      }
    end
  end

  attribute :challenges do
    object.proposal_votes
          .where(position: :block)
          .includes(:account, challenge_conditions: { challenge_responses: :account })
          .order(:created_at)
          .map do |v|
      {
        id: v.id.to_s,
        title: v.title,
        statement: v.statement,
        account: ActiveModelSerializers::SerializableResource.new(
          v.account, serializer: REST::AccountSerializer
        ).as_json,
        conditions: v.challenge_conditions.sort_by(&:created_at).map do |c|
          {
            id: c.id.to_s,
            text: c.text,
            met: c.met?,
            met_at: c.met_at,
            responses: c.challenge_responses.sort_by(&:created_at).map do |r|
              {
                id: r.id.to_s,
                body: r.body,
                created_at: r.created_at,
                account: ActiveModelSerializers::SerializableResource.new(
                  r.account, serializer: REST::AccountSerializer
                ).as_json,
              }
            end,
          }
        end,
      }
    end
  end

  belongs_to :created_by_account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end
end
