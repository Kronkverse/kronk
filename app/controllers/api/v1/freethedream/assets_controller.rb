# frozen_string_literal: true

# Your inventory: private to you. Share an item into a project you're in
# and that project's members can see it in its audit.
class Api::V1::Freethedream::AssetsController < Api::V1::Freethedream::BaseController
  before_action :set_asset, except: [:index, :create]

  def index
    render json: current_assets.includes(:projects).by_category.map { |asset| view.asset(asset) }
  end

  def create
    asset = current_assets.new(asset_params)
    return render_invalid(asset) unless asset.save

    render json: view.asset(asset), status: 201
  end

  def update
    return render_invalid(@asset) unless @asset.update(asset_params)

    render json: view.asset(@asset)
  end

  def destroy
    @asset.destroy!
    render_empty
  end

  def share
    share = @asset.shares.new(project_id: params.require(:project_id))
    return render_invalid(share) unless share.save

    render json: view.asset(@asset.reload)
  end

  def unshare
    @asset.shares.where(project_id: params.require(:project_id)).delete_all
    render json: view.asset(@asset.reload)
  end

  private

  def current_assets
    Freethedream::Asset.where(account_id: current_account.id)
  end

  def set_asset
    @asset = current_assets.find(params[:id])
  end

  def asset_params
    params.expect(asset: [:category, :title, :note, :quantity])
  end
end
