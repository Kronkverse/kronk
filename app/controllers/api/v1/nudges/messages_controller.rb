# frozen_string_literal: true

# POST /api/v1/nudges/conversations/:conversation_id/messages — send a
# text message into an existing Mate conversation. Media + voice
# attachments follow in Phase 1c; voice is kronk-app parity-gated.
class Api::V1::Nudges::MessagesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:notifications' }
  before_action :require_user!
  before_action :set_conversation
  before_action :authorize_participant!

  def create
    message = @conversation.messages.create!(
      author_account: current_account,
      body: params.require(:body).to_s.strip
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
end
