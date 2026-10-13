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

    attrs = project_params.except(:done, :cover_media_attachment_id)
    attrs[:cover] = own_media(project_params[:cover_media_attachment_id]) if project_params[:cover_media_attachment_id].present?
    project = Freethedream::Project.new(attrs.merge(parent: parent, owner: current_account))
    project.joining = 'open' if parent
    return render_invalid(project) unless project.save

    Freethedream::Activity.log!(project: parent, account: current_account, verb: 'section_added', title: project.title, section_id: project.id.to_s) if parent

    render json: view.project(project), status: 201
  end

  def update
    permit!(@project.owned_by?(current_account))

    attrs = project_params.except(:done, :cover_media_attachment_id)
    attrs = attrs.except(:joining) unless @project.top?
    attrs[:cover] = own_media(project_params[:cover_media_attachment_id]) if project_params.key?(:cover_media_attachment_id)
    attrs[:done_at] = done_at(project_params[:done]) if project_params.key?(:done)
    was_done = @project.done?
    return render_invalid(@project) unless @project.update(attrs)

    Freethedream::Activity.log!(project: @project, account: current_account, verb: 'done', title: @project.title) if @project.done? && !was_done

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

  # You've looked at this project's or section's talk: nothing in it is new
  # to you any more.
  def seen
    require_member!(@project.top)
    Freethedream::Read.mark!(@project, current_account)
    render_empty
  end

  def take_over
    take_over!(@project, @project.top)
    render json: view.project(@project)
  end

  def hand_over
    hand_over!(@project, @project.top)
    render json: view.project(@project)
  end

  # Invite people to have a look at a project. Each gets a Nudge linking to
  # the Overview; joining is still their choice. Members only.
  def invite
    permit!(@project.top? && @project.member?(current_account))
    ids = Array(params[:account_ids]).map(&:to_s).uniq.first(Freethedream::Project::INVITE_MAX)
    invited = Account.where(id: ids).where.not(id: current_account.id).reject { |account| @project.member?(account) }

    invited.each do |account|
      Kronk::KornerEvents.publish(
        'freethedream.project.invited',
        actor_account_id: current_account.id,
        recipient_account_id: account.id,
        project_id: @project.id
      )
    end

    render json: { invited: invited.size }
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
    params.expect(project: [:title, :description, :ends_on, :joining, :done, :cover_media_attachment_id])
  end

  # A cover must be an image the person setting it uploaded. Blank clears it.
  def own_media(id)
    return nil if id.blank?

    media = MediaAttachment.find_by(id: id, account_id: current_account.id)
    permit!(media&.image?)
    media
  end

  def done_at(done)
    return nil unless ActiveModel::Type::Boolean.new.cast(done)

    @project.done_at || Time.now.utc
  end
end
