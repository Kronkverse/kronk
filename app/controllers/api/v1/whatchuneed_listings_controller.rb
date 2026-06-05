# frozen_string_literal: true

class Api::V1::WhatchuneedListingsController < Api::BaseController
  before_action :require_user!
  before_action :set_listing, only: [:show, :update, :destroy, :fulfill, :close]
  before_action :require_owner!, only: [:update, :destroy, :fulfill, :close]

  def index
    scope = WhatchuneedListing.visible.includes(:account).recent
    scope = scope.where(category: params[:category]) if params[:category].present? && WhatchuneedListing::CATEGORY_VALUES.include?(params[:category])
    @listings = scope.limit(40)
    render json: @listings, each_serializer: REST::WhatchuneedListingSerializer
  end

  def show
    render json: @listing, serializer: REST::WhatchuneedListingSerializer, include_responses: true
  end

  def create
    @listing = WhatchuneedListing.new(listing_params.merge(account: current_account))
    if @listing.save
      render json: @listing, serializer: REST::WhatchuneedListingSerializer, status: 201
    else
      render json: { error: @listing.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def update
    if @listing.update(listing_params)
      render json: @listing, serializer: REST::WhatchuneedListingSerializer
    else
      render json: { error: @listing.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    @listing.destroy!
    render_empty
  end

  def fulfill
    @listing.update!(status: :fulfilled)
    render json: @listing, serializer: REST::WhatchuneedListingSerializer
  end

  def close
    @listing.update!(status: :closed)
    render json: @listing, serializer: REST::WhatchuneedListingSerializer
  end

  private

  def set_listing
    @listing = WhatchuneedListing.find(params[:id])
  end

  def require_owner!
    forbidden unless @listing.account_id == current_account.id
  end

  def listing_params
    params.expect(listing: [:title, :body, :category])
  end
end
