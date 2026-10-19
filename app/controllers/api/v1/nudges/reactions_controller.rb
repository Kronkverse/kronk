# frozen_string_literal: true

# Reactions on a `Nudges::ConversationMessage`. The model enforces the
# 3-DISTINCT-symbols cap per-message; this controller is the thin API
# in front of `#add_reaction!` / `#remove_reaction!`.
#
#   POST   /api/v1/nudges/conversations/:conversation_id/messages/:message_id/reactions
#     body: { symbol: "👍" }
#   DELETE /api/v1/nudges/conversations/:conversation_id/messages/:message_id/reactions/:symbol
class Api::V1::Nudges::ReactionsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:notifications' }
  before_action :require_user!
  before_action :set_conversation
  before_action :authorize_participant!
  before_action :reject_if_expired!
  before_action :reject_if_blocked!, only: :create
  before_action :set_message

  def create
    symbol = params.require(:symbol).to_s
    @message.add_reaction!(current_account, symbol)
    render json: @message.reload, serializer: REST::Nudges::MessageSerializer, scope: current_account
  rescue Nudges::ConversationMessage::ReactionCapReached
    render json: { error: 'reaction_cap_reached' }, status: :unprocessable_entity
  rescue Nudges::ConversationMessage::Tombstoned
    render json: { error: 'gone' }, status: 410
  end

  def destroy
    symbol = params.require(:symbol).to_s
    @message.remove_reaction!(current_account, symbol)
    render json: @message.reload, serializer: REST::Nudges::MessageSerializer, scope: current_account
  rescue Nudges::ConversationMessage::Tombstoned
    render json: { error: 'gone' }, status: 410
  end

  private

  def set_conversation
    @conversation = Nudges::Conversation.find(params[:conversation_id])
  end

  # A block either way closes a Mate chat to new messages
  # (MessagesController#may_start?), and to new reactions with them.
  def reject_if_blocked!
    return unless @conversation.mate?

    other = @conversation.other_account_for(current_account)
    return unless other && (other.blocking?(current_account) || current_account.blocking?(other))

    render json: { error: 'not_mates' }, status: 403
  end

  def set_message
    @message = @conversation.messages.find(params[:message_id])
  end

  def authorize_participant!
    return if @conversation.participant?(current_account)

    render json: { error: 'not_found' }, status: 404
  end

  def reject_if_expired!
    return unless @conversation.expired?

    render json: { error: 'gone' }, status: 410
  end
end
