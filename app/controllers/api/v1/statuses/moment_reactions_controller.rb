# frozen_string_literal: true

class Api::V1::Statuses::MomentReactionsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:favourites' }
  before_action :require_user!
  before_action :set_status

  def create
    emoji = params[:emoji]
    return render json: { error: 'Invalid emoji' }, status: 422 unless MomentReaction::ALLOWED_EMOJI.include?(emoji)
    return render json: { error: 'Not a moment' }, status: 422 unless @status.moment?

    MomentReaction.find_or_create_by!(
      status: @status,
      account: current_user.account,
      emoji: emoji
    )

    render json: serialize_reactions
  end

  def destroy
    MomentReaction.find_by(
      status: @status,
      account: current_user.account,
      emoji: params[:emoji]
    )&.destroy

    render json: serialize_reactions
  end

  private

  def set_status
    @status = Status.find(params[:status_id])
  end

  def serialize_reactions
    reacted = MomentReaction.exists?(status: @status, account: current_user.account, emoji: 'heart')
    others  = MomentReaction.where(status: @status).where.not(account: current_user.account).exists?
    { heart: { me: reacted, others: others } }
  end
end
