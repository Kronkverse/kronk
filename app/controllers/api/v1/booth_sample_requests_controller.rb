# frozen_string_literal: true

# Asking to use an ask-first sample, and its maker answering
# (docs/spaces/booth.md, Samples). The maker is nudged about each request
# and the asker about the answer; neither need be the other's Mate, as with
# an offer in Wachuneed.
class Api::V1::BoothSampleRequestsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index]
  before_action :require_user!

  # The maker's list: who asked, newest first.
  def index
    sample = visible_sample
    raise Mastodon::NotPermittedError unless sample.account_id == current_account.id

    render json: sample.requests.includes(:account).order(updated_at: :desc), each_serializer: REST::BoothSampleRequestSerializer
  end

  # Ask. Asking again after a no asks again.
  def create
    sample = visible_sample
    raise Mastodon::NotPermittedError unless sample.ask_first? && sample.account_id != current_account.id

    request = sample.requests.find_or_initialize_by(account: current_account)
    if request.new_record? || request.state == 'no'
      request.update!(state: 'pending')
      publish('booth.sample.asked', actor: current_account, recipient_id: sample.account_id, sample: sample)
    end
    render json: sample, serializer: REST::BoothSampleSerializer, detail: true
  end

  # The maker says yes or no.
  def update
    request = BoothSampleRequest.find(params[:id])
    sample = request.booth_sample
    raise Mastodon::NotPermittedError unless sample.account_id == current_account.id

    state = params[:state].to_s
    raise ActionController::BadRequest unless %w(yes no).include?(state)

    if request.state != state
      request.update!(state: state)
      publish(state == 'yes' ? 'booth.sample.granted' : 'booth.sample.declined', actor: current_account, recipient_id: request.account_id, sample: sample)
    end
    render json: request, serializer: REST::BoothSampleRequestSerializer
  end

  private

  def visible_sample
    sample = BoothSample.find(params[:booth_sample_id])
    raise ActiveRecord::RecordNotFound if sample.account.blocking?(current_account)

    sample
  end

  def publish(event, actor:, recipient_id:, sample:)
    Kronk::KornerEvents.publish(event, actor_account_id: actor.id, recipient_account_id: recipient_id, booth_sample_id: sample.id)
  end
end
