# frozen_string_literal: true

# Wachuneed shop fronts (korner: wachuneed; docs/spaces/wachuneed.md,
# Shops). A shop is one seller's live offers on a page of their own,
# under sections they name. One per account, opened by choice.
#
#   GET    /api/v1/wachuneed/shops       every shop with something on offer
#   GET    /api/v1/wachuneed/shops/:id   one shop, by account id or username
#   GET    /api/v1/wachuneed/shops/:id/profile   what a profile shows of it
#   GET    /api/v1/wachuneed/shop        the caller's own (`null` if none)
#   PUT    /api/v1/wachuneed/shop        open it, or save changes to it
#   DELETE /api/v1/wachuneed/shop        close it (the listings stay)
#   PUT    /api/v1/wachuneed/shop/order  your items in the order you want them
class Api::V1::Wachuneed::ShopsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show, :profile, :mine]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:upsert, :order, :destroy]
  before_action :require_user!

  # Shops the caller can see with something on offer they can see. Your
  # Mates' first, then the oldest shop first (Tal 2026-10-12; how the row
  # flows is to be designed later).
  def index
    mate_ids = current_account.mates.pluck(:id).to_set
    offers = Listing.visible_to(current_account).live.offers
    shops = ListingShop.visible_to(current_account).where(account_id: offers.select(:account_id))
                       .includes(:account, :media_attachment).order(:created_at).limit(60)
    shops = shops.sort_by.with_index { |shop, index| [mate_ids.include?(shop.account_id) ? 0 : 1, index] }
    counts = offers.where(account_id: shops.map(&:account_id)).group(:account_id).count

    previews = ListingShop.preview_photos_for(shops.map(&:account_id), current_account)

    render json: shops, each_serializer: REST::WachuneedShopSerializer, listing_counts: counts, previews: previews, viewer: current_account
  end

  def show
    account = Account.find_local(params[:id].to_s.delete_prefix('@')) || Account.find_by(id: Integer(params[:id].to_s, exception: false))
    shop = account && ListingShop.find_by(account_id: account.id)
    raise ActiveRecord::RecordNotFound unless shop&.visible_to?(current_account)

    render json: shop, serializer: REST::WachuneedShopSerializer, detail: true, viewer: current_account
  end

  # The line a profile carries, when the seller chose to show their shop
  # there. Always answers 200: most people have no shop, and that is not an
  # error for the profile that asks.
  def profile
    shop = ListingShop.includes(:account).find_by(account_id: params[:id], show_on_profile: true)
    shop = nil unless shop&.visible_to?(current_account)
    render json: { shop: shop && { name: shop.name, acct: shop.account.acct } }
  end

  # `null` until you open one: asking is how the app finds out.
  def mine
    shop = ListingShop.find_by(account_id: current_account.id)
    return render(json: nil) if shop.nil?

    render json: shop, serializer: REST::WachuneedShopSerializer, detail: true, viewer: current_account
  end

  def upsert
    shop = ListingShop.find_or_initialize_by(account_id: current_account.id)

    ApplicationRecord.transaction do
      shop.assign_attributes(shop_params)
      shop.media_attachment = picture if params.key?(:picture_id)
      shop.save!
      shop.replace_sections!(section_rows) if params.key?(:sections)
    end

    render json: shop.reload, serializer: REST::WachuneedShopSerializer, detail: true, viewer: current_account
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: 422
  end

  # The builder's order for your items: `listing_ids` in the order they
  # should show. Only your own offers that are still up are moved; anything
  # else in the list is skipped.
  def order
    ids = Array(params[:listing_ids]).filter_map { |id| Integer(id.to_s, exception: false) }.uniq
    mine = Listing.offers.active.where(account_id: current_account.id, id: ids).pluck(:id).to_set

    ApplicationRecord.transaction do
      ids.select { |id| mine.include?(id) }.each_with_index do |id, position|
        Listing.where(id: id).update_all(shop_position: position)
      end
    end

    head 204
  end

  def destroy
    ListingShop.find_by(account_id: current_account.id)&.destroy!
    render_empty
  end

  private

  def shop_params
    params.permit(:name, :description, :visibility, :show_on_profile, :payment, :handover, :based_in, :about)
  end

  # The caller's own free upload, or nothing (which removes the picture).
  def picture
    id = Integer(params[:picture_id].to_s, exception: false)
    id && MediaAttachment.find_by(id: id, account: current_account, status_id: nil)
  end

  def section_rows
    Array(params[:sections]).filter_map do |row|
      next unless row.respond_to?(:[])

      { id: row[:id].presence, name: row[:name] }
    end
  end
end
