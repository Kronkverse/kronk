# frozen_string_literal: true

# Shoutouts on a Booth set (docs/spaces/booth.md, Shoutouts): list and post
# them under the set, remove one by id.
class Api::V1::BoothShoutoutsController < Api::BaseController
  LIMIT = 200

  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, except: [:index]
  before_action :require_user!
  before_action :set_booth_set, only: [:index, :create]

  def index
    shoutouts = @booth_set.shoutouts.includes(:account).recent.limit(LIMIT)
    render json: shoutouts, each_serializer: REST::BoothShoutoutSerializer
  end

  def create
    shoutout = @booth_set.shoutouts.create!(
      account: current_account,
      body: params[:body].to_s.strip,
      at_seconds: params[:at_seconds].presence&.to_i
    )
    announce
    render json: shoutout, serializer: REST::BoothShoutoutSerializer
  end

  def destroy
    shoutout = BoothShoutout.find(params[:id])
    raise Mastodon::NotPermittedError unless removable?(shoutout)

    shoutout.destroy!
    render_empty
  end

  private

  # A shoutout is for a set the member can see: published, or their own.
  def set_booth_set
    @booth_set = BoothSet.find(params[:booth_set_id])
    raise ActiveRecord::RecordNotFound unless @booth_set.published? || @booth_set.account_id == current_account.id
  end

  def removable?(shoutout)
    [shoutout.account_id, shoutout.booth_set.account_id].include?(current_account.id) ||
      current_user.role&.can?(:manage_reports)
  end

  # Tell the artist, unless they're shouting out their own set.
  def announce
    return if @booth_set.account_id == current_account.id

    Kronk::KornerEvents.publish(
      'booth.set.shouted',
      actor_account_id: current_account.id,
      recipient_account_id: @booth_set.account_id,
      booth_set_id: @booth_set.id
    )
  end
end
