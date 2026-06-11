# frozen_string_literal: true

class Api::V1::NudgeReactionsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }
  before_action :require_user!
  before_action :set_notification

  def create
    emoji = params[:emoji]
    return render json: { error: 'Invalid emoji' }, status: 422 unless NudgeReaction::ALLOWED_EMOJI.include?(emoji)

    NudgeReaction.find_or_create_by!(
      notification: @notification,
      account: current_user.account
    ) { |r| r.emoji = emoji }.tap { |r| r.update!(emoji: emoji) }

    render json: reactions_json
  end

  def destroy
    NudgeReaction.find_by(notification: @notification, account: current_user.account)&.destroy
    render json: reactions_json
  end

  private

  def set_notification
    @notification = Notification.find(params[:notification_id])
    return if @notification.account_id == current_user.account_id || @notification.from_account_id == current_user.account_id

    render json: { error: 'Not found' }, status: 404
  end

  def reactions_json
    counts = NudgeReaction.where(notification: @notification).group(:emoji).count
    me = NudgeReaction.find_by(notification: @notification, account: current_user.account)&.emoji
    NudgeReaction::ALLOWED_EMOJI.index_with do |emoji|
      { count: counts[emoji] || 0, me: me == emoji }
    end
  end
end
