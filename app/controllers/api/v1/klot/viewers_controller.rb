# frozen_string_literal: true

# Klot — outbound allowlist. Each row is a directional grant permitting
# `viewer` to see the caller's derived phase (only). No symmetry: the
# caller adding someone here does NOT grant themselves inbound access.
#
#   GET    /api/v1/klot/viewers                 — my allowlist
#   POST   /api/v1/klot/viewers                 { account_id }
#   DELETE /api/v1/klot/viewers/:account_id
class Api::V1::Klot::ViewersController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read,  :'read:accounts' },  only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :destroy]
  before_action :require_user!

  def index
    rows = PhaseShare.outbound_from(current_account).includes(:viewer)
    render json: rows.map(&:viewer), each_serializer: REST::Klot::ViewerSerializer
  end

  def create
    target = Account.find_by(id: params[:account_id])
    return render json: { error: 'not_found' }, status: 404 if target.nil?
    return render json: { error: 'not_permitted' }, status: 403 unless viewable?(target)

    PhaseShare.grant!(sharer: current_account, viewer: target)
    render json: target, serializer: REST::Klot::ViewerSerializer
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def destroy
    PhaseShare.outbound_from(current_account).where(viewer_id: params[:account_id]).destroy_all
    head 204
  end

  private

  # Existing relationship rules: the caller can only share their phase
  # with someone they follow. Keeps the allowlist bounded to accounts
  # the caller has already opted a relationship with — no stranger
  # exposure, no scraping via bulk shares.
  def viewable?(target)
    return false if target.suspended? || target.moved_to_account_id.present?

    current_account.following?(target)
  end
end
