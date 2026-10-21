# frozen_string_literal: true

# Requests for Wachuneed listings (docs/spaces/wachuneed.md, Requests). A
# buyer asks for an item with what they chose; the seller accepts or
# declines; the buyer can take it back while it waits. Kronk takes no
# order or payment beyond that. The model is ListingOffer.
#
#   GET  /api/v1/wachuneed/requests?as=seller|buyer   asked of you / by you
#   POST /api/v1/wachuneed/listings/:listing_id/requests
#   POST /api/v1/wachuneed/requests/:id/accept|decline (the seller)
#   POST /api/v1/wachuneed/requests/:id/withdraw       (the buyer)
class Api::V1::Wachuneed::RequestsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index]
  before_action :require_user!
  before_action :set_request, only: [:accept, :decline, :withdraw]

  def index
    scope = ListingOffer.includes(:offerer, listing: [:account, :listing_photos]).recent
    scope = if params[:as] == 'buyer'
              scope.where(offerer: current_account)
            else
              scope.where(listing: Listing.where(account: current_account))
            end

    render json: scope.limit(100), each_serializer: REST::WachuneedRequestSerializer
  end

  def create
    listing = Listing.find(params[:listing_id])
    request = ListingOffer.ask(listing, offerer: current_account,
                                        variant: params[:variant], options: params[:options],
                                        quantity: params.fetch(:quantity, 1), message: params[:message])
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

  private

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
