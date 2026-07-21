# frozen_string_literal: true

# Nudges::Conversation REST controller — powers the messenger shell at
# /nudges. Scoped to the current account: a conversation is visible if
# the account is one of its participants. Ordered most-recent-first.
#
# Non-Mate nudges (from strangers) never appear here per
# docs/kronk_nudges.md §Amendments — the current account only sees
# conversations they're a participant in.
class Api::V1::Nudges::ConversationsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:notifications' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:notifications' }, only: [:read, :leave]
  before_action :require_user!
  before_action :set_conversation, only: [:show, :read, :leave]
  before_action :authorize_participant!, only: [:show, :read, :leave]

  DEFAULT_LIMIT = 40
  MAX_LIMIT     = 80
  STREAM_LIMIT  = 100

  def index
    conversations = Nudges::Conversation
                    .for_account(current_account)
                    .active
                    .recent
                    .limit([params.fetch(:limit, DEFAULT_LIMIT).to_i, MAX_LIMIT].min)

    render json: conversations, each_serializer: REST::Nudges::ConversationSerializer,
           scope: current_account
  end

  def show
    render json: {
      conversation: REST::Nudges::ConversationSerializer.new(@conversation, scope: current_account).as_json,
      stream: interleaved_stream(@conversation),
    }
  end

  def read
    up_to = params[:up_to_message_id].to_i
    @conversation.mark_read!(current_account, up_to.positive? ? up_to : @conversation.messages.maximum(:id))
    render json: REST::Nudges::ConversationSerializer.new(@conversation.reload, scope: current_account)
  end

  # Leave a Krew conversation. Removes the account's
  # ConversationMembership + underlying GroupMembership so they exit
  # the Krew entirely. Krew-only — Mate has no "leave" (the two are
  # locked together by definition; deletion of the pair is a
  # different concern).
  def leave
    unless @conversation.krew?
      render json: { error: 'mate_conversations_cannot_be_left' }, status: :unprocessable_entity
      return
    end

    ActiveRecord::Base.transaction do
      @conversation.memberships.where(account_id: current_account.id).destroy_all
      @conversation.krew&.group_memberships&.where(account_id: current_account.id)&.destroy_all
    end

    head 204
  end

  private

  def set_conversation
    @conversation = Nudges::Conversation.find(params[:id])
  end

  # A conversation is only accessible to its participants — the two
  # Mate accounts or the Krew's members.
  def authorize_participant!
    return if @conversation.participant?(current_account)

    render json: { error: 'not_found' }, status: 404
  end

  # Interleave messages + events chronologically. STREAM_LIMIT rows
  # per fetch is enough for a first render; pagination lands in a
  # follow-up once the shell exercises the API.
  def interleaved_stream(conversation)
    messages = conversation.messages.order(id: :desc).limit(STREAM_LIMIT)
    events   = conversation.events.order(created_at: :desc).limit(STREAM_LIMIT)

    items = messages.map { |m| serialize_message(m) } + events.map { |e| serialize_event(e) }
    items.sort_by { |item| item[:created_at] }.reverse.first(STREAM_LIMIT)
  end

  def serialize_message(message)
    {
      kind: 'message',
      **REST::Nudges::MessageSerializer.new(message, scope: current_account).as_json,
      created_at: message.created_at.iso8601,
    }
  end

  def serialize_event(event)
    {
      kind: 'event',
      **REST::Nudges::EventSerializer.new(event).as_json,
      created_at: event.created_at.iso8601,
    }
  end
end
