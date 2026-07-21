# frozen_string_literal: true

# POST /api/v1/nudges/conversations/:conversation_id/messages — send a
# message into an existing Mate conversation. Text and/or a
# media_attachment (photo/video). Voice recording is kronk-app
# parity-gated per docs/kronk_nudges.md §Surface 4.
class Api::V1::Nudges::MessagesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:notifications' }
  before_action :require_user!
  before_action :set_conversation
  before_action :authorize_participant!

  def create
    body = params[:body].to_s.strip
    media_attachment_id = params[:media_attachment_id].presence

    if body.blank? && media_attachment_id.blank?
      render json: { error: 'body_or_attachment_required' }, status: :unprocessable_entity
      return
    end

    validate_media_ownership!(media_attachment_id) if media_attachment_id

    message = @conversation.messages.create!(
      author_account: current_account,
      body: body.presence,
      media_attachment_id: media_attachment_id
    )

    render json: REST::Nudges::MessageSerializer.new(message, scope: current_account), status: 201
  end

  private

  def set_conversation
    @conversation = Nudges::Conversation.find(params[:conversation_id])
  end

  def authorize_participant!
    return if [@conversation.account_a_id, @conversation.account_b_id].include?(current_account.id)

    render json: { error: 'not_found' }, status: 404
  end

  # Guard against attaching someone else's upload. The MediaAttachment
  # must belong to the current account and not already be attached to
  # a Status.
  def validate_media_ownership!(id)
    media = MediaAttachment.find_by(id: id, account_id: current_account.id, status_id: nil)
    return if media

    render json: { error: 'media_not_found' }, status: :unprocessable_entity
    raise ActionController::BadRequest, 'media_not_found'
  end
end
