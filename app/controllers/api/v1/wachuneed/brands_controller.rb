# frozen_string_literal: true

# Brands in Wachuneed (docs/spaces/wachuneed.md, Brands): brands whose
# mission members have looked into and respect. Any member proposes one;
# it is listed once WachuneedBrand::BACKERS_TO_LIST members back it.
#
#   GET    /api/v1/wachuneed/brands        listed brands, A to Z
#                                          (`status=proposed`: those still
#                                          gathering backers, newest first;
#                                          `category=` narrows either)
#   GET    /api/v1/wachuneed/brands/:id    one brand, with its backers
#   POST   /api/v1/wachuneed/brands        propose one (you back it too)
#   PATCH  /api/v1/wachuneed/brands/:id    the proposer edits it
#   DELETE /api/v1/wachuneed/brands/:id    the proposer, or staff, take it down
#
# Backing is Api::V1::Wachuneed::BrandBackingsController.
class Api::V1::Wachuneed::BrandsController < Api::BaseController
  include Authorization

  LIMIT = 120

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!
  before_action :set_brand, only: [:show, :update, :destroy]

  def index
    scope = WachuneedBrand.shown_to(current_account).includes(:account, :media_attachment, :backings)
    scope = if params[:status] == 'proposed'
              scope.proposed.order(created_at: :desc, id: :desc)
            else
              scope.listed.order(Arel.sql('lower(wachuneed_brands.name)'), :id)
            end
    scope = scope.where(category: params[:category]) if WachuneedBrand::CATEGORIES.include?(params[:category])

    render json: scope.limit(LIMIT), each_serializer: REST::WachuneedBrandSerializer, viewer: current_account
  end

  def show
    render_brand
  end

  def create
    @brand = WachuneedBrand.new(brand_params)
    @brand.account = current_account
    @brand.media_attachment = picture if params.key?(:picture_id)
    @brand.save!

    render_brand
  end

  def update
    authorize @brand, :update?

    @brand.assign_attributes(brand_params)
    @brand.media_attachment = picture if params.key?(:picture_id)
    @brand.save!

    render_brand
  end

  def destroy
    authorize @brand, :destroy?

    @brand.destroy!
    render_empty
  end

  private

  def set_brand
    @brand = WachuneedBrand.shown_to(current_account).find(params[:id])
  end

  def render_brand
    render json: @brand.reload, serializer: REST::WachuneedBrandSerializer, detail: true, viewer: current_account
  end

  def brand_params
    params.permit(:name, :url, :why, :category)
  end

  # The caller's own free upload, or nothing (which removes the picture).
  def picture
    id = Integer(params[:picture_id].to_s, exception: false)
    id && MediaAttachment.find_by(id: id, account: current_account, status_id: nil)
  end
end
