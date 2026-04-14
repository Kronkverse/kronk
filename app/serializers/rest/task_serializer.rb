# frozen_string_literal: true

class REST::TaskSerializer < ActiveModel::Serializer
  attributes :id, :proposal_id, :title, :description, :status,
             :skill_tag, :effort_estimate, :created_at

  belongs_to :assigned_to_account, serializer: REST::AccountSerializer,
             if: -> { object.assigned_to_account_id? }

  def proposal_id
    object.proposal_id.to_s
  end
end
