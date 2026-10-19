# frozen_string_literal: true

# The short thread on a project, part or item. Members comment; you can
# remove your own.
class Api::V1::Freethedream::CommentsController < Api::V1::Freethedream::BaseController
  SUBJECTS = { 'project' => 'Freethedream::Project', 'item' => 'Freethedream::Item' }.freeze
  MENTIONABLE_MAX = 8

  def create
    klass = SUBJECTS.fetch(params.require(:subject_type)) { raise ActiveRecord::RecordNotFound }
    subject = klass.constantize.find(params.require(:subject_id))
    require_member!(subject.is_a?(Freethedream::Project) ? subject : subject.root)

    parent = params[:parent_id].presence && Freethedream::Comment.find(params[:parent_id])
    quoted = params[:quoted_item_id].presence && Freethedream::Item.find(params[:quoted_item_id])
    comment = Freethedream::Comment.new(subject: subject, parent: parent, quoted_item: quoted, account: current_account, body: params[:body].to_s.strip)
    return render_invalid(comment) unless comment.save

    tell_mentioned(comment)
    render json: view.comments(subject), status: 201
  end

  def destroy
    comment = Freethedream::Comment.find(params[:id])
    permit!(comment.account_id == current_account.id)
    comment.remove!
    render json: view.comments(comment.subject)
  end

  # Anyone in the project can mark a thread resolved, or open it again.
  # Resolved threads fold away so what's still live is what you see.
  def resolve
    set_thread
    @thread.update!(resolved_at: Time.now.utc, resolved_by: current_account)
    render json: view.comments(@thread.subject)
  end

  def unresolve
    set_thread
    @thread.update!(resolved_at: nil, resolved_by: nil)
    render json: view.comments(@thread.subject)
  end

  # Who can be tagged in talk: people in the emergence, matching what's
  # been typed after the @ (by username or name), for the suggestions.
  def mentionable
    project = Freethedream::Project.find(params.require(:project_id))
    top = project.top
    require_member!(top)
    query = params[:q].to_s.strip.downcase.delete_prefix('@')
    members = Account.local.where(id: Freethedream::Membership.member.where(project_id: top.id).select(:account_id)).where.not(id: current_account.id)
    if query.present?
      like = "#{ActiveRecord::Base.sanitize_sql_like(query)}%"
      members = members.where('lower(accounts.username) LIKE :like OR lower(accounts.display_name) LIKE :like', like: like)
    end
    render json: members.order(:username).limit(MENTIONABLE_MAX).map { |account| view.account(account) }
  end

  private

  # Each person tagged hears about it, once, and not about their own.
  def tell_mentioned(comment)
    place = comment.subject.is_a?(Freethedream::Project) ? comment.subject : comment.subject.projects.order('freethedream_placements.id').first || comment.emergence
    comment.mentioned_accounts.where.not(id: current_account.id).find_each do |account|
      Kronk::KornerEvents.publish(
        'freethedream.comment.mentioned',
        actor_account_id: current_account.id,
        recipient_account_id: account.id,
        project_id: place.id
      )
    end
  end

  def set_thread
    @thread = Freethedream::Comment.threads.find(params[:id])
    subject = @thread.subject
    require_member!(subject.is_a?(Freethedream::Project) ? subject : subject.root)
  end
end
