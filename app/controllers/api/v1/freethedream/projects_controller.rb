# frozen_string_literal: true

# Emergences (projekts) and their gangs. Anyone in a Krew starts a projekt
# in it; anyone in the projekt coalesces a gang. Only its owner changes or
# removes it. Who sees one follows its Krew (Project#visible_to?).
class Api::V1::Freethedream::ProjectsController < Api::V1::Freethedream::BaseController
  before_action :set_project, except: [:index, :create]

  SCOPES = %w(all mine).freeze
  STARTER_MAX = 20

  def index
    scope = Freethedream::Project.top_level.includes(:owner, :cover).recent
    # One Krew's projekts, for its page (docs/spaces/krew.md, Projekts).
    scope = scope.where(krew_id: params[:krew_id]) if params[:krew_id].present?
    mine = Freethedream::Membership.member.where(account_id: current_account.id).select(:project_id)
    scope = if params[:scope] == 'mine'
              scope.where(id: mine)
            else
              listed = scope.joins(:krew).where(krews: { archived_at: nil }).where.not(krews: { access: 'invite_only' })
              scope.where(id: listed.select(:id)).or(scope.where(id: mine))
            end
    render json: scope.limit(100).map { |project| view.project_summary(project) }
  end

  def show
    require_visible!(@project)
    render json: view.project(@project)
  end

  # The latest updates alone, so an open page can keep its Activity live
  # without loading the whole project again.
  def activity
    require_visible!(@project)
    render json: view.activity(@project)
  end

  def create
    parent = params.dig(:project, :parent_id).presence && Freethedream::Project.find(params[:project][:parent_id])
    require_member!(parent) if parent
    krew = parent ? nil : own_krew
    return render json: { error: 'Pick one of your Krews for it to live in' }, status: 422 if parent.nil? && krew.nil?

    attrs = project_params.except(:done, :cover_media_attachment_id, :joining, :krew_id)
    attrs[:cover] = own_media(project_params[:cover_media_attachment_id]) if project_params[:cover_media_attachment_id].present?
    project = Freethedream::Project.new(attrs.merge(parent: parent, owner: current_account, krew: krew))
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

    attrs = project_params.except(:done, :cover_media_attachment_id, :joining, :krew_id)
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

  # Join the projekt's Krew, or ask to, which is the way into the projekt
  # (and every other projekt in that Krew). Joining a part joins the
  # projekt it's in. An invite-only Krew is joined from its own page.
  def join
    require_visible!(@project)
    top = @project.top
    case top.joining_via_krew
    when 'open' then top.add_member!(current_account)
    when 'by_request' then top.ask_to_join!(current_account)
    else raise Mastodon::NotPermittedError
    end
    render json: view.project(@project)
  end

  # Withdraw a request to join. Someone in it leaves the Krew instead, from
  # the Krew's page: being in a projekt is being in its Krew.
  def leave
    top = @project.top
    permit!(!top.member?(current_account))
    top.remove_member!(current_account)
    render json: view.project(@project)
  end

  # Join a Komponent, to hear about it (Freethedream::GangNudges). Only
  # someone in the projekt, and only a Komponent: a fractal's news comes
  # through its Komponent.
  def join_gang
    require_member!(@project.top)
    raise Mastodon::NotPermittedError unless @project.gang?

    Freethedream::GangMember.find_or_create_by!(project: @project, account: current_account)
    render json: view.project(@project)
  end

  def leave_gang
    Freethedream::GangMember.where(project: @project, account: current_account).delete_all
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

  private

  def set_project
    @project = Freethedream::Project.by_link!(params[:id])
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
      item = Freethedream::Item.create!(
        kind: 'need', title: need[:title], category: starter_category(need),
        quantity: need[:quantity].presence || 1, unit: need[:unit].to_s,
        more_welcome: ActiveModel::Type::Boolean.new.cast(need[:more_welcome]) || false,
        root_id: project.top_id, owner: current_account
      )
      item.placements.create!(project: project)
      Freethedream::Activity.log!(project: project, account: current_account, verb: 'need_added', item: item, title: item.title, quantity: item.quantity, unit: item.unit)
      Freethedream::MyceliumMatch.nudge_for(item)
    end
  end

  def starter_category(need)
    category = need[:category].to_s
    Freethedream::Item::CATEGORIES.key?(category.to_sym) ? category : nil
  end

  def starter_sections
    Array(params[:sections]).filter_map { |title| title.to_s.strip.presence }.uniq.first(STARTER_MAX)
  end

  def starter_needs
    Array(params[:needs]).first(STARTER_MAX).filter_map do |need|
      need = need.permit(:title, :quantity, :unit, :more_welcome, :category) if need.respond_to?(:permit)
      need if need.is_a?(ActionController::Parameters) && need[:title].to_s.strip.present?
    end
  end

  def project_params
    params.expect(project: [:title, :description, :ends_on, :joining, :done, :cover_media_attachment_id, :krew_id])
  end

  # The Krew a new projekt goes into: one of yours that is still going.
  def own_krew
    krew = Krew.active.find_by(id: project_params[:krew_id]) if project_params[:krew_id].present?
    krew if krew&.member?(current_account)
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
