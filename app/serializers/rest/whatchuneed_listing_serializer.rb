# frozen_string_literal: true

class REST::WhatchuneedListingSerializer < ActiveModel::Serializer
  attributes :id, :title, :body, :category, :status, :response_count, :created_at

  belongs_to :account, serializer: REST::AccountSerializer

  attribute :responses, if: :include_responses? do
    object.whatchuneed_responses.includes(:account).order(created_at: :asc).map do |r|
      ActiveModelSerializers::SerializableResource.new(r, serializer: REST::WhatchuneedResponseSerializer).as_json
    end
  end

  def id
    object.id.to_s
  end

  def include_responses?
    instance_options[:include_responses]
  end
end
