# frozen_string_literal: true

# Projects and parts. A top-level project is created by anyone; a part by
# anyone who has joined the project it's in. Only its owner changes or
# removes it.
class Api::V1::Freethedream::ProjectsController < Api::V1::Freethedream::BaseController
  before_action :set_project, except: [:index, :create]

  SCOPES = %w(all mine).freeze

  def index
    scope = Freethedream::Project.top_level.includes(:owner).recent
    scope = scope.where(id: Freethedream::Membership.where(account_id: current_account.id).select(:project_id)) if params[:scope] == 'mine'
    render json: scope.limit(100).map { |project| view.project_summary(project) }
  end

  def show
    render json: view.project(@project)
  end

  def create
    parent = params.dig(:project, :parent_id).presence && Freethedream::Project.find(params[:project][:parent_id])
    require_member!(parent) if parent

    project = Freethedream::Project.new(project_params.except(:done).merge(parent: parent, owner: current_account))
    project.joining = 'open' if parent
    return render_invalid(project) unless project.save

    render json: view.project(project), status: 201
  end

  def update
    permit!(@project.owned_by?(current_account))

    attrs = project_params.except(:done)
    attrs = attrs.except(:joining) unless @project.top?
    attrs[:done_at] = done_at(project_params[:done]) if project_params.key?(:done)
    return render_invalid(@project) unless @project.update(attrs)

    render json: view.project(@project)
  end

  def destroy
    permit!(@project.owned_by?(current_account) && !@project.holds_others_work?(current_account))
    @project.remove!
    render_empty
  end

  # Join a project, or ask to when it's by request. Joining a part joins
  # the project it's in.
  def join
    top = @project.top
    membership = Freethedream::Membership.find_or_initialize_by(project: top, account: current_account)
    membership.state = top.open_joining? ? :member : :requested if membership.new_record?
    membership.save!
    render json: view.project(@project)
  end

  # Leave, or withdraw a request. What you made stays, up for grabs; your
  # job slots and shared inventory go with you.
  def leave
    Freethedream::Membership.where(project_id: @project.top_id, account_id: current_account.id).destroy_all
    Freethedream::Share.where(project_id: @project.top_id, asset_id: current_account_asset_ids).delete_all
    Freethedream::Claim.where(account_id: current_account.id, item_id: Freethedream::Item.where(root_id: @project.top_id).select(:id)).delete_all
    render json: view.project(@project)
  end

  def take_over
    take_over!(@project, @project.top)
    render json: view.project(@project)
  end

  def hand_over
    hand_over!(@project, @project.top)
    render json: view.project(@project)
  end

  # The synergistic audit: the project's needs against what its members
  # have shared. Members only, since shared inventory is theirs to see.
  def audit
    require_member!(@project)
    render json: view.audit(@project.top)
  end

  private

  def set_project
    @project = Freethedream::Project.find(params[:id])
  end

  def current_account_asset_ids
    Freethedream::Asset.where(account_id: current_account.id).select(:id)
  end

  def project_params
    params.expect(project: [:title, :description, :ends_on, :joining, :done])
  end

  def done_at(done)
    return nil unless ActiveModel::Type::Boolean.new.cast(done)

    @project.done_at || Time.now.utc
  end
end
