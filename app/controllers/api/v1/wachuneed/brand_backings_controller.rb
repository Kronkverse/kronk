# frozen_string_literal: true

# Backing a brand in Wachuneed (docs/spaces/wachuneed.md, Brands). One
# backing per member; backing twice is still one.
#
#   POST   /api/v1/wachuneed/brands/:brand_id/backing   back it
#   DELETE /api/v1/wachuneed/brands/:brand_id/backing   take your backing back
#
# The proposer backs their brand from the start and can't take that back
# (they take the brand down instead). Both answer with the brand.
class Api::V1::Wachuneed::BrandBackingsController < Api::BaseController
  include Authorization

  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }
  before_action :require_user!
  before_action :set_brand

  def create
    authorize @brand, :back?

    @brand.back!(current_account)
    render_brand
  end

  def destroy
    @brand.unback!(current_account)
    render_brand
  end

  private

  def set_brand
    @brand = WachuneedBrand.shown_to(current_account).find(params[:brand_id])
  end

  def render_brand
    render json: @brand.reload, serializer: REST::WachuneedBrandSerializer, detail: true, viewer: current_account
  end
end
