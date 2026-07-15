# frozen_string_literal: true

# Kronk Groups (§Groups) — a shareable multi-poster primitive. Seeders
# plant them; membership is opt-in. Governance framework decides how
# structural changes get enacted.
#
#   GET    /api/v1/groups             (discoverable listing)
#   GET    /api/v1/groups/:id
#   POST   /api/v1/groups             (create; creator auto-becomes seeder)
#   PATCH  /api/v1/groups/:id         (seeder-only; name/description/discoverable)
#   DELETE /api/v1/groups/:id         (seeder-only; archives rather than deletes)
#   POST   /api/v1/groups/:id/join
#   POST   /api/v1/groups/:id/leave
class Api::V1::GroupsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :update, :destroy, :join, :leave]
  before_action :require_user!, only: [:create, :update, :destroy, :join, :leave]
  before_action :set_group, only: [:show, :update, :destroy, :join, :leave]

  DEFAULT_LIMIT = 40

  def index
    scope = case params[:scope]
            when 'mine'
              # Groups the viewer belongs to (member or seeder). Includes
              # non-discoverable ones — private groups only surface here.
              current_account.groups.reorder(:name)
            when 'all'
              # Discoverable + viewer's own, union'd. Useful for the Ӂ menu
              # "Groups" surface where users want both.
              discover = Group.discoverable
              mine = current_account&.groups || Group.none
              Group.where(id: discover.select(:id)).or(Group.where(id: mine.select(:id))).reorder(:name)
            else
              Group.discoverable.order(:name)
            end

    scope = scope.limit(limit_param(DEFAULT_LIMIT))
    scope = scope.where(Group.arel_table[:id].lt(params[:max_id])) if params[:max_id].present?
    scope = scope.where(Group.arel_table[:id].gt(params[:min_id])) if params[:min_id].present?

    render json: scope, each_serializer: REST::GroupSerializer, scope: current_user
  end

  def show
    render json: @group, serializer: REST::GroupSerializer, scope: current_user
  end

  def create
    group = Group.new(create_params)

    ActiveRecord::Base.transaction do
      group.save!
      group.group_memberships.create!(account: current_account, role: 'seeder')
    end

    render json: group, serializer: REST::GroupSerializer, scope: current_user
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def update
    return render json: { error: 'seeders only' }, status: 403 unless @group.seeder?(current_account)

    @group.update!(update_params)
    render json: @group, serializer: REST::GroupSerializer, scope: current_user
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.message }, status: 422
  end

  def destroy
    return render json: { error: 'seeders only' }, status: 403 unless @group.seeder?(current_account)

    @group.update!(archived_at: Time.current)
    render json: @group, serializer: REST::GroupSerializer, scope: current_user
  end

  def join
    return render json: @group, serializer: REST::GroupSerializer, scope: current_user if @group.member?(current_account)

    @group.group_memberships.create!(account: current_account, role: 'member')
    render json: @group, serializer: REST::GroupSerializer, scope: current_user
  end

  def leave
    membership = @group.group_memberships.find_by(account: current_account)
    return render json: @group, serializer: REST::GroupSerializer, scope: current_user if membership.nil?

    return render json: { error: 'cannot leave — you are the last seeder. Nominate another first or archive the group.' }, status: 422 if membership.role == 'seeder' && @group.group_memberships.where(role: 'seeder').one?

    membership.destroy!
    render json: @group, serializer: REST::GroupSerializer, scope: current_user
  end

  private

  def set_group
    @group = Group.find(params[:id])
  end

  def create_params
    params.permit(:slug, :name, :description, :discoverable, :governance_framework, :governance_threshold)
  end

  def update_params
    params.permit(:name, :description, :discoverable, :governance_framework, :governance_threshold)
  end
end
