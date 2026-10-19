# frozen_string_literal: true

# Requests to join a by-request emergence. They are its Krew's requests, one
# list whichever page someone asked from, and anyone in can let someone in
# or say not now (Tal, 2026-10-19: err syntropic).
class Api::V1::Freethedream::RequestsController < Api::V1::Freethedream::BaseController
  before_action :set_request

  def accept
    asker = @request.account
    @request.accept! # KrewMembership#join_emergence puts them in the emergence
    Kronk::KrewJoinRequests.notify_accepted(@request.krew, asker, by: current_account)
    render json: view.project(@project)
  end

  def decline
    @request.destroy!
    render json: view.project(@project)
  end

  private

  def set_request
    @project = Freethedream::Project.find(params[:project_id])
    permit!(@project.top? && @project.member?(current_account))
    @request = @project.join_requests.find_by!(account_id: params[:account_id])
  end
end
