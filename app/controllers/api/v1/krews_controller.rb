# frozen_string_literal: true

# Kronk Krews (§Krews) — a shareable multi-poster primitive. Seeders
# plant them; membership is opt-in. Governance framework decides how
# structural changes get enacted.
#
#   GET    /api/v1/krews             (discoverable listing)
#   GET    /api/v1/krews/:id
#   POST   /api/v1/krews             (create; creator auto-becomes seeder)
#   PATCH  /api/v1/krews/:id         (seeder-only; name/description/discoverable)
#   DELETE /api/v1/krews/:id         (seeder-only; archives rather than deletes)
#   POST   /api/v1/krews/:id/join
#   POST   /api/v1/krews/:id/leave
class Api::V1::KrewsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :update, :destroy, :join, :leave]
  before_action :require_user!, only: [:create, :update, :destroy, :join, :leave]
  before_action :set_krew, only: [:show, :update, :destroy, :join, :leave]

  DEFAULT_LIMIT = 40

  def index
    scope = case params[:scope]
            when 'mine'
              # Krews the viewer belongs to (member or seeder). Includes
              # non-discoverable ones — private krews only surface here.
              current_account.krews.reorder(:name)
            when 'all'
              # Discoverable + viewer's own, union'd. Useful for the Ӂ menu
              # "Krews" surface where users want both.
              discover = Krew.discoverable
              mine = current_account&.krews || Krew.none
              Krew.where(id: discover.select(:id)).or(Krew.where(id: mine.select(:id))).reorder(:name)
            else
              Krew.discoverable.order(:name)
            end

    scope = scope.limit(limit_param(DEFAULT_LIMIT))
    scope = scope.where(Krew.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    scope = scope.where(Krew.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?

    render json: scope, each_serializer: REST::KrewSerializer, scope: current_user
  end

  def show
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  end

  def create
    krew = Krew.new(create_params)

    ActiveRecord::Base.transaction do
      krew.save!
      krew.krew_memberships.create!(account: current_account, role: 'seeder')
    end

    render json: krew, serializer: REST::KrewSerializer, scope: current_user
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def update
    return render json: { error: 'seeders only' }, status: 403 unless @krew.seeder?(current_account)

    @krew.update!(update_params)
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def destroy
    return render json: { error: 'seeders only' }, status: 403 unless @krew.seeder?(current_account)

    @krew.update!(archived_at: Time.current)
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  end

  def join
    return render json: @krew, serializer: REST::KrewSerializer, scope: current_user if @krew.member?(current_account)

    @krew.krew_memberships.create!(account: current_account, role: 'member')
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  end

  def leave
    membership = @krew.krew_memberships.find_by(account: current_account)
    return render json: @krew, serializer: REST::KrewSerializer, scope: current_user if membership.nil?

    return render json: { error: 'cannot leave — you are the last seeder. Nominate another first or archive the krew.' }, status: 422 if membership.role == 'seeder' && @krew.krew_memberships.where(role: 'seeder').one?

    membership.destroy!
    render json: @krew, serializer: REST::KrewSerializer, scope: current_user
  end

  private

  def set_krew
    @krew = Krew.find(params[:id])
  end

  def create_params
    params.permit(:slug, :name, :description, :discoverable, :governance_framework, :governance_threshold)
  end

  def update_params
    params.permit(:name, :description, :discoverable, :governance_framework, :governance_threshold)
  end
end
