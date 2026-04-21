# frozen_string_literal: true

class REST::ProposalSerializer < ActiveModel::Serializer
  attributes :id, :title, :body, :summary, :status,
             :proposal_type, :categories,
             :parent_proposal_id, :discussion_status_id,
             :outcome_notes, :opens_at,
             :support_count, :veto_count, :participation_count,
             :created_at

  def parent_proposal_id
    object.parent_proposal_id&.to_s
  end

  def discussion_status_id
    object.discussion_status_id&.to_s
  end

  attribute :current_vote do
    vote = object.proposal_votes.find_by(account: current_user&.account)
    vote ? { position: vote.position, statement: vote.statement } : nil
  end

  attribute :vote_summary do
    {
      agree:   object.proposal_votes.where(position: :agree).count,
      abstain: object.proposal_votes.where(position: :abstain).count,
      block:   object.proposal_votes.where(position: :block).count,
    }
  end

  attribute :task_summary do
    {
      open:        object.tasks.where(status: :open).count,
      in_progress: object.tasks.where(status: :in_progress).count,
      done:        object.tasks.where(status: :done).count,
    }
  end

  attribute :budget_total do
    object.budget_items.sum(:cost_estimate).to_f
  end

  attribute :voters do
    object.proposal_votes.includes(:account).order(:created_at).map do |v|
      {
        position: v.position,
        statement: v.statement,
        account: ActiveModelSerializers::SerializableResource.new(
          v.account, serializer: REST::AccountSerializer
        ).as_json,
      }
    end
  end

  belongs_to :created_by_account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end
end
