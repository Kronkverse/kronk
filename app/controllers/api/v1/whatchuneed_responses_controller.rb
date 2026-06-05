# frozen_string_literal: true

class Api::V1::WhatchuneedResponsesController < Api::BaseController
  before_action :require_user!
  before_action :set_listing
  before_action :set_response, only: [:destroy]
  before_action :require_response_owner!, only: [:destroy]

  def create
    @response = @listing.whatchuneed_responses.new(
      account: current_account,
      body: params.dig(:response, :body).to_s.strip
    )
    if @response.save
      render json: @response, serializer: REST::WhatchuneedResponseSerializer, status: 201
    else
      render json: { error: @response.errors.full_messages.to_sentence }, status: :unprocessable_entity
    end
  end

  def destroy
    @response.destroy!
    render_empty
  end

  private

  def set_listing
    @listing = WhatchuneedListing.find(params[:listing_id])
  end

  def set_response
    @response = @listing.whatchuneed_responses.find(params[:id])
  end

  def require_response_owner!
    forbidden unless @response.account_id == current_account.id
  end
end
