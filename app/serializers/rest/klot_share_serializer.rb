# frozen_string_literal: true

# Owner-only view of the allowlist. The owner sees WHO can view their phase.
class REST::KlotShareSerializer < ActiveModel::Serializer
  attributes :id, :created_at

  belongs_to :viewer_account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end
end
