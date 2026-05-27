# frozen_string_literal: true

class REST::ProposalSummarySerializer < ActiveModel::Serializer
  attributes :id, :title, :body, :summary, :status, :proposal_type,
             :support_count, :veto_count, :participation_count,
             :categories, :created_at

  def id
    object.id.to_s
  end
end
