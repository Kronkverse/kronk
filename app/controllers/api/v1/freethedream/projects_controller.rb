# frozen_string_literal: true

# Emergences and their gangs. Anyone seeds an emergence; anyone who has
# joined it coalesces a gang. Only its owner changes or removes it.
class Api::V1::Freethedream::ProjectsController < Api::V1::Freethedream::BaseController
  before_action :set_project, except: [:index, :create]

  SCOPES = %w(all mine).freeze
  STARTER_MAX = 20

  def index
    scope = Freethedream::Project.top_level.includes(:owner).recent
    scope = scope.where(id: Freethedream::Membership.where(account_id: current_account.id).select(:project_id)) if params[:scope] == 'mine'
    render json: scope.limit(100).map { |project| view.project_summary(project) }
  end

  def show
    render json: view.project(@project)
  end

  # The latest updates alone, so an open page can keep its Activity live
  # without loading the whole project again.
  def activity
    render json: view.activity(@project)
  end

  def create
    parent = params.dig(:project, :parent_id).presence && Freethedream::Project.find(params[:project][:parent_id])
    require_member!(parent) if parent

    attrs = project_params.except(:done, :cover_media_attachment_id)
    attrs[:cover] = own_media(project_params[:cover_media_attachment_id]) if project_params[:cover_media_attachment_id].present?
    project = Freethedream::Project.new(attrs.merge(parent: parent, owner: current_account))
    project.joining = 'open' if parent
    Freethedream::Project.transaction do
      project.save!
      start!(project)
    end

    Freethedream::Activity.log!(project: parent, account: current_account, verb: 'section_added', title: project.title, section_id: project.id.to_s) if parent

    render json: view.project(project), status: 201
  rescue ActiveRecord::RecordInvalid => e
    render_invalid(e.record)
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
    if top.open_joining?
      top.add_member!(current_account)
    else
      Freethedream::Membership.find_or_create_by!(project: top, account: current_account) { |m| m.state = :requested }
    end
    render json: view.project(@project)
  end

  # Leave, or withdraw a request (which leaves the Krew too).
  def leave
    @project.top.remove_member!(current_account)
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

  # A new emergence can start with its first gangs, a gang with its
  # fractals, and any of them with the gear all of it needs, so setting one
  # up is one step: `sections` is a list of names (none for a fractal,
  # which holds nothing), `needs` a list of { title, quantity, unit,
  # more_welcome }.
  def start!(project)
    (project.fractal? ? [] : starter_sections).each do |title|
      section = Freethedream::Project.create!(title: title, parent: project, owner: current_account, joining: 'open')
      Freethedream::Activity.log!(project: project, account: current_account, verb: 'section_added', title: section.title, section_id: section.id.to_s)
    end

    starter_needs.each do |need|
      item = Freethedream::Item.create!(kind: 'need', title: need[:title], quantity: need[:quantity].presence || 1, unit: need[:unit].to_s, more_welcome: ActiveModel::Type::Boolean.new.cast(need[:more_welcome]) || false, root_id: project.top_id, owner: current_account)
      item.placements.create!(project: project)
      Freethedream::Activity.log!(project: project, account: current_account, verb: 'need_added', item: item, title: item.title, quantity: item.quantity, unit: item.unit)
    end
  end

  def starter_sections
    Array(params[:sections]).filter_map { |title| title.to_s.strip.presence }.uniq.first(STARTER_MAX)
  end

  def starter_needs
    Array(params[:needs]).first(STARTER_MAX).filter_map do |need|
      need = need.permit(:title, :quantity, :unit, :more_welcome) if need.respond_to?(:permit)
      need if need.is_a?(ActionController::Parameters) && need[:title].to_s.strip.present?
    end
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
