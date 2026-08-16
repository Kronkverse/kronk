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

    ApplicationRecord.transaction do
      @listing.save!
      attach_media!(@listing, media_attachment_ids_param)
    end

    # Project a live listing into the feed + the owner's profile by
    # creating its companion Status (the `wachuneed_card`). After the
    # transaction commits so fan-out sees the finished listing + photos;
    # idempotent + only for live listings (drafts stay off the timeline).
    Martketplace::PublishListing.new(@listing).call if @listing.state == 'live'

    render json: @listing, serializer: REST::WachuneedListingSummarySerializer
  end

  private

  def set_listing
    @listing = Listing.find(params[:id])
  end

  def listing_params
    params.permit(:title, :description, :category, :subcategory, :price_cents, :price_currency, :location, :state)
  end

  # Accept a homogeneous array of media_attachment_ids under either
  # `media_attachment_ids[]` (form encoding) or `media_attachment_ids`
  # (JSON body). Anything else is dropped.
  def media_attachment_ids_param
    ids = params[:media_attachment_ids]
    return [] if ids.blank?

    Array(ids).filter_map { |id| Integer(id.to_s, exception: false) }
  end

  # Bind each media attachment (owned by the caller, not yet attached
  # to another parent) to the listing via ListingPhoto. Preserves the
  # incoming order as the row's `position`. Silently skips ids that
  # don't resolve to the caller's own free attachments — the composer
  # never sends stale ids in practice.
  def attach_media!(listing, ids)
    return if ids.empty?

    scope = MediaAttachment.where(id: ids, account: current_account, status_id: nil)
    ordered = ids.filter_map { |id| scope.find { |m| m.id == id } }
    ordered.each_with_index do |media, index|
      ListingPhoto.create!(listing: listing, media_attachment: media, position: index)
    end
  end
end
