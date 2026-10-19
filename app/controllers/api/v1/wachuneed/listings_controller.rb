# frozen_string_literal: true

# Wachuneed listings API (korner: wachuneed). Reads the live listings
# for the /hub/wachuneed browse pages (Offered, and wanted for
# Desired); creates a listing; lets the owner edit one (update,
# owner-only). Detail/browse
# render via REST::WachuneedListingSummarySerializer (the same shape
# the feed card embeds). Mirrors the Events/Proposals korner
# controllers.
#
# Naming history: marketplace → wachuneed (2026-07-21) →
# mARTketplace/martketplace (2026-07-24) → wachuneed (2026-09-07).
class Api::V1::Wachuneed::ListingsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :close]
  before_action :require_user!
  before_action :set_listing, only: [:show, :update, :close]

  def index
    scope = Listing.includes(:account, :listing_photos).order(created_at: :desc)

    # `?mine=true` — the Mine section: the caller's own listings,
    # across every state (live / reserved / closed) so the owner can
    # see their whole shelf. Anon browse (`mine` absent) still only
    # shows `live` so nothing half-closed leaks into discovery.
    # Browse shows only what the caller can see (the listing's reach).
    scope = if ActiveModel::Type::Boolean.new.cast(params[:mine])
              scope.where(account: current_account)
            else
              scope.live.visible_to(current_account)
            end

    # `?kind=offer` — the Offered section (what's on offer); `?kind=wanted`
    # — the Desired section (what people are looking for). Absent, or
    # unknown, returns both, which is what older clients expect.
    scope = scope.where(kind: params[:kind]) if Listing::KINDS.include?(params[:kind])
    scope = scope.where.not(account_id: Block.where(target_account_id: current_account.id).select(:account_id))

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
           include_account: true,
           viewer: current_account
  end

  def create
    @listing = Listing.new(listing_params)
    @listing.account = current_account
    @listing.options = params[:options] if params.key?(:options)
    @listing.variants = params[:variants] if params.key?(:variants)

    ApplicationRecord.transaction do
      @listing.save!
      attach_media!(@listing, media_attachment_ids_param)
    end

    # Project a live listing into the feed + the owner's profile by
    # creating its companion Status (the `wachuneed_card`). After the
    # transaction commits so fan-out sees the finished listing + photos;
    # idempotent + only for live listings (drafts stay off the timeline).
    publish_if_announced!

    render json: @listing, serializer: REST::WachuneedListingSummarySerializer
  end

  # Owner-only edit (Kommons #117288815620009072: "giving the user an
  # opportunity to edit a service they have uploaded"). Same fields and
  # validations as create. `media_attachment_ids` is optional: absent
  # leaves the photos alone, present (even empty) replaces them in order.
  def update
    authorize_owner!

    reach_before = @listing.visibility

    ApplicationRecord.transaction do
      # `options` replaces the whole set when sent (an empty list removes
      # them) and is left alone when absent, like the photos.
      @listing.options = params[:options] if params.key?(:options)
      @listing.variants = params[:variants] if params.key?(:variants)
      @listing.update!(listing_params)

      if params.key?(:media_attachment_ids)
        @listing.listing_photos.destroy_all
        attach_media!(@listing, media_attachment_ids_param)
      end
    end

    # The companion Status carries the title as its text; keep it in step.
    @listing.status&.update_column(:text, @listing.title) if @listing.saved_change_to_title?
    # And its reach, when the seller changed who can see the listing.
    Wachuneed::PublishListing.new(@listing).rescope(before: reach_before)
    # Closed by update: off the feed, the same as the close action.
    remove_feed_post! if @listing.saved_change_to_state? && @listing.state == 'closed'
    # A draft that goes live, or a quiet shop item the seller now
    # announces, reaches the feed the same way a new one does.
    publish_if_announced!

    render json: @listing.reload,
           serializer: REST::WachuneedListingSummarySerializer,
           include_account: true,
           viewer: current_account
  rescue ActiveRecord::RecordInvalid
    render json: { error: @listing.errors.full_messages.to_sentence }, status: 422
  end

  # Owner-only take-down (Kommons #117425228463050298: sold, or just no
  # longer on offer). The listing is closed, not deleted: it leaves browse
  # (which shows `live` only) and its feed post is removed, but it stays on
  # the owner's Mine section and keeps its offers. There is no reopening;
  # list it again as a new one (docs/spaces/wachuneed.md, States).
  def close
    authorize_owner!

    @listing.close! unless @listing.state == 'closed'
    remove_feed_post!

    render json: @listing.reload,
           serializer: REST::WachuneedListingSummarySerializer,
           include_account: true,
           viewer: current_account
  end

  private

  # The feed card (and the profile's copy of it). A shop adds items quietly
  # unless the seller ticks Announce; an ordinary listing always is.
  # Idempotent: a listing already posted is left as it is.
  def publish_if_announced!
    Wachuneed::PublishListing.new(@listing).call if @listing.state == 'live' && @listing.announced?
  end

  # The companion Status is the feed card. Removed the way a deleted post
  # is; `Status has_one :listing, dependent: :nullify` clears the link.
  def remove_feed_post!
    status = @listing.status
    return if status.nil?

    status.discard_with_reblogs
    RemovalWorker.perform_async(status.id)
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless @listing.account_id == current_account.id
  end

  # A draft is its owner's alone, and a listing someone can't see (its
  # reach, or the poster blocked them) is a 404, as if it weren't there.
  def set_listing
    @listing = Listing.find(params[:id])
    return if @listing.account_id == current_account&.id
    raise ActiveRecord::RecordNotFound if @listing.state == 'draft' || !@listing.visible_to?(current_account)
  end

  def listing_params
    params.permit(:title, :description, :category, :subcategory, :price_cents, :price_currency, :location, :state, :kind,
                  :listing_shop_section_id, :ongoing, :availability, :announced, :visibility)
  end

  # Accept a homogeneous array of media_attachment_ids under either
  # `media_attachment_ids[]` (form encoding) or `media_attachment_ids`
  # (JSON body). Anything else is dropped, as is anything past
  # Listing::MAX_PHOTOS.
  def media_attachment_ids_param
    ids = params[:media_attachment_ids]
    return [] if ids.blank?

    Array(ids).filter_map { |id| Integer(id.to_s, exception: false) }.uniq.first(Listing::MAX_PHOTOS)
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
    # `photo_variants` says which choice a photo shows: { media id => "Blue" }.
    shows = params[:photo_variants]
    shows = shows.respond_to?(:to_unsafe_h) ? shows.to_unsafe_h : {}

    ordered.each_with_index do |media, index|
      ListingPhoto.create!(listing: listing, media_attachment: media, position: index,
                           variant_value: shows[media.id.to_s].to_s.strip.first(40).presence)
    end
  end
end
