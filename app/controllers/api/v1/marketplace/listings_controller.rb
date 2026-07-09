# frozen_string_literal: true

class Api::V1::Marketplace::ListingsController < Api::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create]
  before_action :require_user!, only: [:create]
  before_action :set_listing, only: [:show]

  LIMIT = 40

  def index
    scope = MarketplaceListing.active.recent.includes(:account, shared_status: :media_attachments)
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
  # the listing's marketplace section. Media attached to the listing
  # rides on this status, which is also how it federates and how it
  # appears on the detail page (via the shared_status association).
  # If posting fails for any reason we log and swallow — the listing
  # itself is already committed.
  def share_to_feed!(listing)
    text = compose_share_text(listing)

    status = PostStatusService.new.call(
      current_account,
      text: text,
      visibility: params[:visibility] || current_account.user&.setting_default_privacy || 'public',
      media_ids: media_ids,
      application: doorkeeper_token.application
    )

    listing.update!(status_id: status.id) if status
  rescue => e
    Rails.logger.warn("Marketplace share failed for listing #{listing.id}: #{e.class}: #{e.message}")
  end

  # Coerce the media_ids param into an array of strings, filtering out
  # blanks. Accepts either an array (form/JSON multipart) or a single value.
  def media_ids
    ids = params[:media_ids]
    Array(ids).flatten.reject(&:blank?).map(&:to_s)
  end

  # The status body is deliberately minimal now that the timeline
  # renders a full Marketplace card for every share. Title only, mirroring
  # how Kommons proposals share to the feed. Users who want richer
  # commentary can add it via a manual reply on the shared status.
  def compose_share_text(listing)
    listing.title
  end
end
