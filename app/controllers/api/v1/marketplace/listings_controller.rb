# frozen_string_literal: true

class Api::V1::Marketplace::ListingsController < Api::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:statuses' }, only: [:index, :show]
  before_action :set_listing, only: [:show]

  LIMIT = 40

  def index
    scope = MarketplaceListing.active.recent.includes(:account)
    scope = scope.in_category(params[:category]) if MarketplaceListing::CATEGORIES.include?(params[:category])
    scope = scope.limit(LIMIT)

    render json: scope, each_serializer: REST::MarketplaceListingSerializer
  end

  def show
    render json: @listing, serializer: REST::MarketplaceListingSerializer
  end

  private

  def set_listing
    @listing = MarketplaceListing.find(params[:id])
  end
end
