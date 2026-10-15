# frozen_string_literal: true

# Requests to join a by-request project. The project's owner accepts one or
# says not now.
class Api::V1::Freethedream::RequestsController < Api::V1::Freethedream::BaseController
  before_action :set_request

  def accept
    @request.update!(state: :member) # Membership#join_krew puts them in the Krew
    render json: view.project(@project)
  end

  def decline
    @request.destroy!
    render json: view.project(@project)
  end

  private

  def set_request
    @project = Freethedream::Project.find(params[:project_id])
    permit!(@project.top? && @project.owned_by?(current_account) && @project.member?(current_account))
    @request = Freethedream::Membership.requested.find_by!(project_id: @project.id, account_id: params[:account_id])
  end
end
