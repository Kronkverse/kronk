# frozen_string_literal: true

# Someone asking to use an ask-first sample, as its maker sees it.
class REST::BoothSampleRequestSerializer < ActiveModel::Serializer
  attributes :id, :state, :created_at, :updated_at

  belongs_to :account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end
end
