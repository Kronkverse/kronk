# frozen_string_literal: true

# Owner-only CRUD over the user's own logged period starts.
class Api::V1::Klot::PeriodsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read,  :'read:statuses' },  only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :destroy]
  before_action :require_user!
  before_action :set_period, only: [:destroy]

  def index
    scope = current_account.klot_periods.most_recent_first.limit(120)
    render json: scope, each_serializer: REST::KlotPeriodSerializer
  end

  def create
    period = current_account.klot_periods.find_or_create_by!(started_on: params[:started_on])
    render json: period, serializer: REST::KlotPeriodSerializer, status: :created
  end

  def destroy
    @period.destroy!
    head :no_content
  end

  private

  def set_period
    @period = current_account.klot_periods.find(params[:id])
  end
end
