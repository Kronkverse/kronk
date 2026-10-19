# frozen_string_literal: true

# Showing an item in another part too (one generator under Live Stage and
# Kitchen). Any member adds a placement; the item's owner removes one, as
# long as it still shows somewhere.
class Api::V1::Freethedream::PlacementsController < Api::V1::Freethedream::BaseController
  before_action :set_item

  def create
    require_member!(@item.root)
    placement = @item.placements.new(project_id: params.require(:project_id))
    return render_invalid(placement) unless placement.save

    render json: view.item(@item), status: 201
  end

  def destroy
    permit!(@item.owned_by?(current_account) && @item.placements.many?)
    @item.placements.where(project_id: params[:id]).delete_all
    render json: view.item(@item)
  end

  private

  def set_item
    @item = Freethedream::Item.find(params[:item_id])
  end
end
