# frozen_string_literal: true

class Api::V1::Marketplace::ListingsController < Api::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create]
  before_action :require_user!, only: [:create]
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

  def create
    ApplicationRecord.transaction do
      @listing = current_account.marketplace_listings.create!(listing_params)
      share_to_feed!(@listing) unless params[:skip_share] == true
    end

    render json: @listing, serializer: REST::MarketplaceListingSerializer, status: :created
  end

  private

  def set_listing
    @listing = MarketplaceListing.find(params[:id])
  end

  def listing_params
    params.permit(:title, :description, :category, :subcategory, :price_display, :price_numeric, :location)
  end

  # Auto-shares a newly-created listing to the poster's feed as a public
  # status so the community can see it in their timelines. Links back to
  # the listing's marketplace section. If posting fails for any reason we
  # log and swallow — the listing itself is already committed.
  def share_to_feed!(listing)
    text = compose_share_text(listing)

    status = PostStatusService.new.call(
      current_account,
      text: text,
      visibility: params[:visibility] || current_account.user&.setting_default_privacy || 'public',
      application: doorkeeper_token.application
    )

    listing.update!(status_id: status.id) if status
  rescue => e
    Rails.logger.warn("Marketplace share failed for listing #{listing.id}: #{e.class}: #{e.message}")
  end

  def compose_share_text(listing)
    header = "#{listing.title} — #{listing.category_label}"
    header << " · #{listing.price_display}" if listing.price_display.present?

    body = listing.description.to_s.strip
    body = "#{body[0, 240].rstrip}…" if body.length > 240

    url = "#{root_url.chomp('/')}/marketplace/#{listing.category_slug}"

    [header, body.presence, url].compact.join("\n\n")
  end
end
