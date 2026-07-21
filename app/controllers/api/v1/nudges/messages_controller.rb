# frozen_string_literal: true

# Nudges::ConversationMessage REST controller. Text/media send +
# tombstone-and-410 deletion (author-only) per
# docs/kronk_nudges.md non-negotiables.
#
#   POST   /api/v1/nudges/conversations/:conversation_id/messages
#   DELETE /api/v1/nudges/conversations/:conversation_id/messages/:id
class Api::V1::Nudges::MessagesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:notifications' }
  before_action :require_user!
  before_action :set_conversation
  before_action :authorize_participant!
  before_action :reject_if_expired!
  before_action :set_message, only: [:destroy]

  def create
    body = params[:body].to_s.strip
    # Accept both `media_attachment_id` (singular, back-compat with Phase
    # 1i) and `media_attachment_ids` (plural, new). Merge, dedup, cap
    # enforced in the model.
    media_ids = Array(params[:media_attachment_ids])
    media_ids << params[:media_attachment_id] if params[:media_attachment_id].present?
    media_ids = media_ids.map(&:to_s).compact_blank.uniq

    if body.blank? && media_ids.empty?
      render json: { error: 'body_or_attachment_required' }, status: :unprocessable_entity
      return
    end

    return unless validate_media_ownership!(media_ids)

    message = @conversation.messages.create!(
      author_account: current_account,
      body: body.presence,
      media_attachment_ids: media_ids
    )

    render json: REST::Nudges::MessageSerializer.new(message, scope: current_account), status: 201
  end

  # Author-only soft delete. The row stays (id claimed, no reuse);
  # the serializer redacts body/media/reactions past this point. A
  # subsequent DELETE on the same id returns 410.
  def destroy
    return render json: { error: 'gone' }, status: 410 if @message.tombstoned?
    return render json: { error: 'forbidden' }, status: 403 unless @message.author_account_id == current_account.id

    @message.tombstone!
    render json: REST::Nudges::MessageSerializer.new(@message, scope: current_account)
  end

  private

  def set_conversation
    @conversation = Nudges::Conversation.find(params[:conversation_id])
  end

  def set_message
    @message = @conversation.messages.find(params[:id])
  end

  def authorize_participant!
    return if @conversation.participant?(current_account)

    render json: { error: 'not_found' }, status: 404
  end

  def reject_if_expired!
    return unless @conversation.expired?

    render json: { error: 'gone' }, status: 410
  end

  # Guard against attaching someone else's upload. Every id in `ids`
  # must be an uncommitted MediaAttachment belonging to the current
  # account (status_id nil). Returns true on success, false + renders
  # the error response otherwise.
  def validate_media_ownership!(ids)
    return true if ids.empty?

    valid_count = MediaAttachment.where(id: ids, account_id: current_account.id, status_id: nil).count
    return true if valid_count == ids.size

    render json: { error: 'media_not_found' }, status: :unprocessable_entity
    false
  end
end
