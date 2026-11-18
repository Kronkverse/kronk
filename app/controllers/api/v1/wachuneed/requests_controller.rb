# frozen_string_literal: true

# Requests for Wachuneed listings (docs/spaces/wachuneed.md, Requests). A
# buyer asks for an item with what they chose; the seller accepts or
# declines; the buyer can take it back while it waits. Kronk takes no
# order or payment beyond that. The model is ListingOffer.
#
#   GET  /api/v1/wachuneed/requests?as=seller|buyer   asked of you / by you
#        (&listing_id= for one of your own listings' requests or answers)
#   POST /api/v1/wachuneed/listings/:listing_id/requests
#   POST /api/v1/wachuneed/requests/:id/accept|decline (the seller)
#   POST /api/v1/wachuneed/requests/:id/withdraw       (the buyer)
#   POST /api/v1/wachuneed/requests/:id/cancel         (either, once accepted)
#   POST /api/v1/wachuneed/requests/:id/deliver        (whoever answered, once chosen)
#   POST /api/v1/wachuneed/requests/:id/complete       (the poster, once chosen)
#
# A request for a booked listing is a booking: it also takes `starts_at`,
# `route` ({ from: { lat, lng, name }, to: … }) and `details`, as the
# listing's parts ask (docs/spaces/wachuneed.md, Booking). On a wanted ad
# it is an answer instead: `amount_cents` and `message` (docs/spaces/
# wachuneed.md, Answering a wanted ad); accept chooses it.
class Api::V1::Wachuneed::RequestsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index]
  before_action :require_user!
  before_action :set_request, only: [:accept, :decline, :withdraw, :cancel, :deliver, :complete]

  def index
    scope = ListingOffer.includes(:offerer, :cancelled_by, listing: [:account, :listing_photos]).recent
    scope = if params[:as] == 'buyer'
              scope.where(offerer: current_account)
            else
              scope.where(listing: Listing.where(account: current_account))
            end
    scope = scope.where(listing_id: Listing.by_link!(params[:listing_id]).id) if params[:listing_id].present?

    render json: scope.limit(100), each_serializer: REST::WachuneedRequestSerializer
  end

  def create
    listing = Listing.by_link!(params[:listing_id])
    request = if listing.wanted?
                ListingOffer.pitch(listing, offerer: current_account, amount_cents: params[:amount_cents], message: params[:message])
              else
                ask(listing)
              end
    request.save!

    render json: request, serializer: REST::WachuneedRequestSerializer
  rescue ActiveRecord::RecordInvalid
    render json: { error: request.errors.full_messages.to_sentence }, status: 422
  end

  def accept
    respond_as(:seller) { @request.accept! }
  end

  def decline
    respond_as(:seller) { @request.decline! }
  end

  def withdraw
    respond_as(:buyer) { @request.withdraw! }
  end

  # Only an accepted booking, by either of the two.
  def cancel
    return render(json: { error: 'Only an accepted booking can be called off' }, status: 422) unless @request.state == 'accepted' && @request.booking?

    @request.cancel!(by: current_account)
    render json: @request.reload, serializer: REST::WachuneedRequestSerializer
  end

  # A chosen answer to a wanted ad, carried through: delivered by whoever
  # answered, then done by the poster (docs/spaces/wachuneed.md, Answering
  # a wanted ad).
  def deliver
    carry_through(:buyer) { @request.deliver! unless @request.delivered_at }
  end

  def complete
    carry_through(:seller) { @request.complete! unless @request.completed_at }
  end

  private

  def carry_through(side)
    owner = side == :seller ? @request.listing.account_id : @request.offerer_id
    raise Mastodon::NotPermittedError unless owner == current_account.id
    return render(json: { error: 'Only a chosen answer is carried through' }, status: 422) unless @request.pitch? && @request.state == 'accepted'

    yield
    render json: @request.reload, serializer: REST::WachuneedRequestSerializer
  end

  def ask(listing)
    ListingOffer.ask(listing, offerer: current_account,
                              variant: params[:variant], options: params[:options],
                              quantity: params.fetch(:quantity, 1), message: params[:message],
                              starts_at: params[:starts_at], route: params[:route], details: params[:details],
                              ticket_date_id: params[:ticket_date_id])
  end

  # Only someone party to it finds it at all.
  def set_request
    @request = ListingOffer.find(params[:id])
    seller = @request.listing.account_id == current_account.id
    raise ActiveRecord::RecordNotFound unless seller || @request.offerer_id == current_account.id
  end

  # Answered once: a request already accepted, declined or taken back is
  # left as it is.
  def respond_as(side)
    owner = side == :seller ? @request.listing.account_id : @request.offerer_id
    raise Mastodon::NotPermittedError unless owner == current_account.id
    return render(json: { error: 'This request has been answered' }, status: 422) unless @request.pending?

    yield
    render json: @request.reload, serializer: REST::WachuneedRequestSerializer
  end
end
