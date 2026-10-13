# frozen_string_literal: true

# The short thread on a project, part or item. Members comment; you can
# remove your own.
class Api::V1::Freethedream::CommentsController < Api::V1::Freethedream::BaseController
  SUBJECTS = { 'project' => 'Freethedream::Project', 'item' => 'Freethedream::Item' }.freeze

  def create
    klass = SUBJECTS.fetch(params.require(:subject_type)) { raise ActiveRecord::RecordNotFound }
    subject = klass.constantize.find(params.require(:subject_id))
    require_member!(subject.is_a?(Freethedream::Project) ? subject : subject.root)

    parent = params[:parent_id].presence && Freethedream::Comment.find(params[:parent_id])
    comment = Freethedream::Comment.new(subject: subject, parent: parent, account: current_account, body: params[:body].to_s.strip)
    return render_invalid(comment) unless comment.save

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

  private

  def set_thread
    @thread = Freethedream::Comment.threads.find(params[:id])
    subject = @thread.subject
    require_member!(subject.is_a?(Freethedream::Project) ? subject : subject.root)
  end
end
