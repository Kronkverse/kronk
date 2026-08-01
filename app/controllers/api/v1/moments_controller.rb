# frozen_string_literal: true

# Moments — ephemeral photo/video posts (docs/spaces/moments.md).
# Every Moment is a first-class row that projects to a Status for
# feed presence via post_status_service! (mirrors the Kalendar Event
# controller pattern per its lessons-learned comment on transaction
# ordering — status creation lives OUTSIDE the Moment save so
# DistributionWorker can find the row).
class Api::V1::MomentsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:statuses' }, only: [:create, :update, :destroy]
  before_action :require_user!
  before_action :set_moment, only: [:show, :update, :destroy]

  # Standard pagination for a subject's active Moments — newest first.
  # If no `account` is passed, defaults to the current viewer's own
  # active Moments (useful for the composer / Home strip owner tile).
  # `scope=mates` (Home strip) returns the union of the viewer's own
  # active moments + all active moments from accounts the viewer
  # follows. Otherwise returns a single account's moments (defaults
  # to the viewer).
  # Every Moment the viewer is allowed to see, per each Moment's own
  # visibility (reach ladder + krew) — this is the whole collection, gated
  # per-moment, not a fixed audience. Powers the top-of-Home strip and the
  # Moments korner (both its active "top" section and its permanent log).
  #
  #   filter=log → the permanent archive (expired moments, kept forever)
  #   default    → active (still inside the 24h window)
  #   account_id → narrow to one author (the deep-link viewer's stack)
  def index
    scope = Moment.visible_to(current_account)
    scope = scope.for_account(Account.find(params[:account_id])) if params[:account_id].present?
    scope = params[:filter] == 'log' ? scope.expired : scope.active

    @moments = scope.recent.includes(:account, :media_attachment).limit(60)
    render json: @moments, each_serializer: REST::MomentSerializer
  end

  def show
    raise ActiveRecord::RecordNotFound unless @moment.visible_to?(current_account)

    # Opening a Moment in the viewer counts as seeing it — dims its ring and
    # ticks down the Moments unread badge. See Kronk::KornerSeen.
    Kronk::KornerSeen.mark_seen(current_account, 'moments', @moment.id)

    render json: @moment, serializer: REST::MomentSerializer
  end

  def create
    @moment = current_account.moments.new(moment_params)

    # Fixed 24h expiry per discovery (docs/spaces/moments.md § Expiry).
    # Not user-adjustable; the mechanic IS the identity.
    @moment.expires_at = Time.current + Moment::DEFAULT_LIFETIME

    @moment.save!

    render json: @moment, serializer: REST::MomentSerializer
  end

  # Change a Moment's audience after it's posted — "visibility can be
  # changed at any time" (Stage 3). Owner only. The model's
  # krew_only_when_krew_visibility validation keeps krew_id consistent.
  def update
    authorize_moment_owner!
    @moment.update!(update_params)
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

  # Update only touches the audience — media/caption are fixed once
  # posted. krew_id is cleared when moving to a non-krew visibility.
  def update_params
    permitted = params.permit(:visibility, :krew_id)
    permitted[:krew_id] = nil if permitted[:visibility].present? && permitted[:visibility] != 'krew'
    permitted
  end
end
