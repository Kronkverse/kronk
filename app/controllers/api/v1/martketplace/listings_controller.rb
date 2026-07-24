# frozen_string_literal: true

# mARTketplace listings API (korner: martketplace, renamed from
# wachuneed 2026-07-24, renamed from marketplace 2026-07-21). Reads the
# live listings for the /hub/martketplace browse page; creates a listing.
# Detail/browse render via REST::WachuneedListingSummarySerializer (the
# same shape the feed card embeds). Mirrors the Events/Proposals korner
# controllers.
class Api::V1::Martketplace::ListingsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create]
  before_action :require_user!
  before_action :set_listing, only: [:show]

  def index
    scope = Listing.includes(:account, :listing_photos).order(created_at: :desc)

    # `?mine=true` — the wachugot view: the caller's own listings,
    # across every state (live / reserved / closed) so the owner can
    # see their whole shelf. Anon browse (`mine` absent) still only
    # shows `live` so nothing half-closed leaks into discovery.
    scope = if ActiveModel::Type::Boolean.new.cast(params[:mine])
              scope.where(account: current_account)
            else
              scope.live
            end

    @listings = scope.limit(40)
    render json: @listings, each_serializer: REST::WachuneedListingSummarySerializer
  end

  def show
    render json: @listing, serializer: REST::WachuneedListingSummarySerializer
  end

  def create
    @listing = Listing.new(listing_params)
    @listing.account = current_account
    @listing.save!

    render json: @listing, serializer: REST::WachuneedListingSummarySerializer
  end

  private

  def set_listing
    @listing = Listing.find(params[:id])
  end

  def listing_params
    params.permit(:title, :description, :category, :subcategory, :price_cents, :price_currency, :location, :state)
  end
end
