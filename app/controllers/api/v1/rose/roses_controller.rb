# frozen_string_literal: true

# Rose — the day's stack, and the tap that adds to someone else's.
#
#   GET  /api/v1/rose/roses          today's roses for the signed-in account
#   GET  /api/v1/rose/roses?direction=sent
#                                    today's roses the signed-in account has
#                                    sent — the profile button reads this to
#                                    know it has already been tapped today
#   POST /api/v1/rose/roses          send one (params: to_account_id)
#
# "Today" is the Kronk day, which begins at 3am Australia/Sydney for
# everybody (Rose.current_day). Nothing here pages: a day's stack is
# bounded by how many Mates you have, and the page draws all of it.
class Api::V1::Rose::RosesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:follows' }, only: [:create]
  before_action :require_user!

  def index
    @roses = if params[:direction] == 'sent'
               Rose.sent_by(current_account).for_day(Rose.current_day)
                   .includes(:to_account)
                   .order(created_at: :asc, id: :asc)
             else
               Rose.today_for(current_account).includes(:from_account)
             end

    render json: @roses, each_serializer: REST::RoseSerializer
  end

  def create
    target = Account.find(params[:to_account_id])
    rose = Rose::SendService.new(current_account, target).call

    render json: rose, serializer: REST::RoseSerializer, status: 201
  rescue Rose::SendService::NotMatesError
    render json: { error: I18n.t('rose.not_mates') }, status: 403
  rescue Rose::SendService::AlreadySentError
    # Not a failure the sender needs to fix — they already did the thing.
    render json: { error: I18n.t('rose.already_sent') }, status: 409
  end
end
