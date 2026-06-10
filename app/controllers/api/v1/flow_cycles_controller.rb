# frozen_string_literal: true

class Api::V1::FlowCyclesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show, :shared_with_me]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy, :share, :unshare]
  before_action :require_user!
  before_action :set_flow_cycle, only: [:show, :update, :destroy, :share, :unshare]

  def index
    @cycles = current_account.flow_cycles.recent.includes(:flow_cycle_shares)
    render json: @cycles, each_serializer: REST::FlowCycleSerializer
  end

  def shared_with_me
    @cycles = FlowCycle
              .joins(:flow_cycle_shares)
              .where(flow_cycle_shares: { account_id: current_account.id })
              .includes(:account, :flow_cycle_shares)
              .recent
    render json: @cycles, each_serializer: REST::FlowCycleSerializer
  end

  def show
    authorize_visible!
    render json: @cycle, serializer: REST::FlowCycleSerializer
  end

  def create
    @cycle = current_account.flow_cycles.new(cycle_params)
    @cycle.save!
    render json: @cycle, serializer: REST::FlowCycleSerializer
  end

  def update
    authorize_owner!
    @cycle.update!(cycle_params)
    render json: @cycle, serializer: REST::FlowCycleSerializer
  end

  def destroy
    authorize_owner!
    @cycle.destroy!
    render_empty
  end

  def share
    authorize_owner!
    target = Account.find(params[:account_id])
    @cycle.flow_cycle_shares.find_or_create_by!(account: target)
    render json: @cycle, serializer: REST::FlowCycleSerializer
  end

  def unshare
    authorize_owner!
    @cycle.flow_cycle_shares.find_by(account_id: params[:account_id])&.destroy!
    render_empty
  end

  private

  def set_flow_cycle
    @cycle = FlowCycle.find(params[:id])
  end

  def owner?
    @cycle.account_id == current_account.id
  end

  def visible?
    owner? || @cycle.shared_with?(current_account)
  end

  def authorize_owner!
    raise Mastodon::NotPermittedError unless owner?
  end

  def authorize_visible!
    raise ActiveRecord::RecordNotFound unless visible?
  end

  def cycle_params
    params.permit(:started_on, :ended_on, :cycle_length, :notes)
  end
end
