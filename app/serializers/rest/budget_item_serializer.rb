# frozen_string_literal: true

class REST::BudgetItemSerializer < ActiveModel::Serializer
  attributes :id, :proposal_id, :description, :cost_estimate, :currency, :status

  def proposal_id
    object.proposal_id.to_s
  end

  def cost_estimate
    object.cost_estimate.to_f
  end
end
