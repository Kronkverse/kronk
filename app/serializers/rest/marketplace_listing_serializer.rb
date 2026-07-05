# frozen_string_literal: true

class REST::MarketplaceListingSerializer < ActiveModel::Serializer
  attributes :id, :title, :description, :category, :subcategory,
             :price_display, :price_numeric, :location, :status,
             :created_at, :updated_at, :status_id

  belongs_to :account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  def status_id
    object.status_id&.to_s
  end
end
