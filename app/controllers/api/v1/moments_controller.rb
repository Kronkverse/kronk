# frozen_string_literal: true

# Moments — ephemeral photo/video posts (docs/spaces/moments.md).
# Every Moment is a first-class row that projects to a Status for
# feed presence via post_status_service! (mirrors the Kalendar Event
# controller pattern per its lessons-learned comment on transaction
# ordering — status creation lives OUTSIDE the Moment save so
# DistributionWorker can find the row).
class Api::V1::MomentsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :destroy]
  before_action :require_user!
  before_action :set_moment, only: [:show, :destroy]

  # Standard pagination for a subject's active Moments — newest first.
  # If no `account` is passed, defaults to the current viewer's own
  # active Moments (useful for the composer / Home strip owner tile).
  # `scope=mates` (Home strip) returns the union of the viewer's own
  # active moments + all active moments from accounts the viewer
  # follows. Otherwise returns a single account's moments (defaults
  # to the viewer).
  def index
    @moments =
      if params[:scope] == 'mates'
        follow_ids = current_account.following.pluck(:id)
        subject_ids = follow_ids + [current_account.id]
        Moment.where(account_id: subject_ids)
      else
        account = params[:account_id].present? ? Account.find(params[:account_id]) : current_account
        Moment.for_account(account)
      end

    @moments = @moments.active.recent.includes(:account, :media_attachment).limit(60)
    render json: @moments, each_serializer: REST::MomentSerializer
  end

  def show
    render json: @moment, serializer: REST::MomentSerializer
  end

  def create
    @moment = current_account.moments.new(moment_params)

    # Fixed 24h expiry per discovery (docs/spaces/moments.md § Expiry).
    # Not user-adjustable; the mechanic IS the identity.
    @moment.expires_at = Time.current + Moment::DEFAULT_LIFETIME

    @moment.save!
    create_status_for_moment!(@moment)

    render json: @moment, serializer: REST::MomentSerializer
  end

  def destroy
    authorize_moment_owner!
    @moment.destroy!
    render_empty
  end

  private

  def set_moment
    @moment = Moment.find(params[:id])
  end

  def authorize_moment_owner!
    raise Mastodon::NotPermittedError unless @moment.account_id == current_account.id
  end

  def moment_params
    permitted = params.permit(:media_attachment_id, :caption, :visibility, :krew_id)
    permitted[:visibility] = permitted[:visibility].presence || 'mates'
    permitted[:krew_id] = nil unless permitted[:visibility] == 'krew'
    permitted
  end

  def create_status_for_moment!(moment)
    status_text = moment.caption.presence || ''
    # 'mates' and 'krew' both fold to Mastodon's `private` (followers-
    # only) at the Status level; the fine-grained scoping lives on the
    # Moment row itself (visibility + krew_id). Only 'public_reach'
    # widens the Status.
    status_visibility = moment.visible_to_public_reach? ? 'public' : 'private'

    status = PostStatusService.new.call(
      current_account,
      text: status_text,
      visibility: status_visibility,
      application: doorkeeper_token.application,
      media_ids: [moment.media_attachment_id]
    )

    moment.update!(status: status)
    status.update_column(:source_korner, 'moments') # feed projection discriminator (§3.2)
    status.touch
  end
end
