# frozen_string_literal: true

# One part depending on another. Anyone in the project can link two parts;
# the dependent part's owner can unlink them.
class Api::V1::Freethedream::DependenciesController < Api::V1::Freethedream::BaseController
  before_action :set_project

  def create
    require_member!(@project)
    dependency = @project.dependencies.new(depends_on_id: params.require(:depends_on_id))
    return render_invalid(dependency) unless dependency.save

    render json: view.project(@project), status: 201
  end

  def destroy
    permit!(@project.owned_by?(current_account))
    @project.dependencies.where(depends_on_id: params[:id]).delete_all
    render json: view.project(@project)
  end

  private

  def set_project
    @project = Freethedream::Project.find(params[:project_id])
  end
end
