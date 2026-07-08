# frozen_string_literal: true

# Owner's allowlist of viewers.
class Api::V1::Klot::SharesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read,   :'read:statuses' },  only: [:index]
  before_action -> { doorkeeper_authorize! :write,  :'write:statuses' }, only: [:create, :destroy]
  before_action :require_user!
  before_action :set_share, only: [:destroy]

  def index
    scope = current_account.klot_shares.includes(:viewer_account)
    render json: scope, each_serializer: REST::KlotShareSerializer
  end

  def create
    viewer = resolve_viewer!
    share = current_account.klot_shares.find_or_create_by!(viewer_account: viewer)
    render json: share, serializer: REST::KlotShareSerializer, status: :created
  end

  def destroy
    @share.destroy!
    head :no_content
  end

  private

  def set_share
    @share = current_account.klot_shares.find(params[:id])
  end

  # Accept either a numeric viewer_account_id or a local acct (with or
  # without leading @). Local-only for MVP — no remote federation.
  def resolve_viewer!
    if params[:viewer_account_id].present?
      Account.find(params[:viewer_account_id])
    elsif params[:acct].present?
      acct = params[:acct].to_s.sub(/\A@/, '')
      raise ActiveRecord::RecordNotFound if acct.include?('@')

      Account.find_by!(username: acct, domain: nil)
    else
      raise ActionController::ParameterMissing, 'viewer_account_id or acct'
    end
  end
end
