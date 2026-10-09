# frozen_string_literal: true

# Wachuneed listings API (korner: wachuneed). Reads the live listings
# for the /hub/wachuneed browse pages (on offer, and wanted for
# Wachumissing); creates a listing; lets the owner edit one (update,
# owner-only). Detail/browse
# render via REST::WachuneedListingSummarySerializer (the same shape
# the feed card embeds). Mirrors the Events/Proposals korner
# controllers.
#
# Naming history: marketplace → wachuneed (2026-07-21) →
# mARTketplace/martketplace (2026-07-24) → wachuneed (2026-09-07).
class Api::V1::Wachuneed::ListingsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update]
  before_action :require_user!
  before_action :set_listing, only: [:show, :update]

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

    # `?kind=offer` — the Wachuneed view (what's on offer); `?kind=wanted`
    # — the Wachumissing view (what people are looking for). Absent, or
    # unknown, returns both, which is what older clients expect.
    scope = scope.where(kind: params[:kind]) if Listing::KINDS.include?(params[:kind])

    @listings = scope.limit(40)
    render json: @listings, each_serializer: REST::WachuneedListingSummarySerializer
  end

  def show
    # Detail view — include the poster's account so the client can
    # render "posted by @acct" + a "message the poster" action.
    # The grid/browse view (:index) omits `include_account` because
    # the tile only needs title + price + photo.
    render json: @listing,
           serializer: REST::WachuneedListingSummarySerializer,
           include_account: true
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
    Wachuneed::PublishListing.new(@listing).call if @listing.state == 'live'

    render json: @listing, serializer: REST::WachuneedListingSummarySerializer
  end

  # Owner-only edit (Kommons #117288815620009072: "giving the user an
  # opportunity to edit a service they have uploaded"). Same fields and
  # validations as create. `media_attachment_ids` is optional: absent
  # leaves the photos alone, present (even empty) replaces them in order.
  def update
    authorize_owner!

    ApplicationRecord.transaction do
      @listing.update!(listing_params)

      if params.key?(:media_attachment_ids)
        @listing.listing_photos.destroy_all
        attach_media!(@listing, media_attachment_ids_param)
      end
    end

    # The companion Status carries the title as its text; keep it in step.
    @listing.status&.update_column(:text, @listing.title) if @listing.saved_change_to_title?
    # A draft that goes live reaches the feed the same way a new one does.
    Wachuneed::PublishListing.new(@listing).call if @listing.state == 'live'

    render json: @listing.reload,
           serializer: REST::WachuneedListingSummarySerializer,
           include_account: true
  rescue ActiveRecord::RecordInvalid
    render json: { error: @listing.errors.full_messages.to_sentence }, status: 422
  end

  private

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @listing.account_id == current_account.id
  end

  def set_listing
    @listing = Listing.find(params[:id])
  end

  def listing_params
    params.permit(:title, :description, :category, :subcategory, :price_cents, :price_currency, :location, :state, :kind)
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
