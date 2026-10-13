# frozen_string_literal: true

# The short thread on a project, part or item. Members comment; you can
# remove your own.
class Api::V1::Freethedream::CommentsController < Api::V1::Freethedream::BaseController
  SUBJECTS = { 'project' => 'Freethedream::Project', 'item' => 'Freethedream::Item' }.freeze

  def create
    klass = SUBJECTS.fetch(params.require(:subject_type)) { raise ActiveRecord::RecordNotFound }
    subject = klass.constantize.find(params.require(:subject_id))
    require_member!(subject.is_a?(Freethedream::Project) ? subject : subject.root)

    comment = Freethedream::Comment.new(subject: subject, account: current_account, body: params[:body].to_s.strip)
    return render_invalid(comment) unless comment.save

    render json: view.comments(subject), status: 201
  end

  def destroy
    comment = Freethedream::Comment.find(params[:id])
    permit!(comment.account_id == current_account.id)
    comment.destroy!
    render_empty
  end
end
