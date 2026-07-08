# frozen_string_literal: true

class Api::V1::Tree::DependenciesController < Api::BaseController
  before_action -> { authorize_if_got_token! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :destroy]
  before_action :require_user!, only: [:create, :destroy]
  before_action :set_dep, only: [:destroy]

  def index
    render json: TreeDependency.all, each_serializer: REST::TreeDependencySerializer
  end

  def create
    dep = TreeDependency.create!(dep_params)
    render json: dep, serializer: REST::TreeDependencySerializer, status: :created
  end

  def destroy
    @dep.destroy!
    head :no_content
  end

  private

  def set_dep
    @dep = TreeDependency.find(params[:id])
  end

  def dep_params
    params.permit(:from_node_id, :to_node_id, :kind)
  end
end
