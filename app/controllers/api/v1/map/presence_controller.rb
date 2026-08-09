# frozen_string_literal: true

# Map — presence. Opt-in, coarsened location (docs/spaces/map.md).
#
#   GET    /api/v1/map/presence       — pins visible to me right now
#   GET    /api/v1/map/presence/self  — my own pin (or null)
#   POST   /api/v1/map/presence       — place / re-place me
#   DELETE /api/v1/map/presence       — remove me (hard delete)
#
# The `index` action IS the privacy contract (mirrors Klot's CircleController):
# it returns an explicit hash per row and never anything beneath the already-
# coarsened point — no serializer, no `include :account` leaking fields. The
# `friends` scope is Mates-gated (mutual follow), not one-way following.
class Api::V1::Map::PresenceController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :destroy]
  before_action :require_user!

  def index
    base = PresenceState.active.where.not(account_id: current_account.id)

    visible = base.where(share_scope: :friends, account_id: current_account.mates.select(:id))
                  .or(base.where(share_scope: :kommunity))
                  .includes(:account)

    render json: visible.map { |state| project(state) }
  end

  def show
    state = PresenceState.find_by(account_id: current_account.id)
    render json: state && !state.expired? ? project(state, self_view: true) : nil
  end

  def create
    state = PresenceState.place!(
      current_account,
      raw_lat: params.require(:lat),
      raw_lng: params.require(:lng),
      precision: params.require(:precision),
      scope: params[:share_scope].presence || 'friends',
      label: params[:label],
      ttl_minutes: params[:ttl_minutes].presence || PresenceState::DEFAULT_TTL_MINUTES
    )

    render json: project(state, self_view: true)
  rescue ActionController::ParameterMissing => e
    render json: { error: e.message }, status: 400
  rescue ArgumentError => e
    render json: { error: e.message }, status: 422
  rescue ActiveRecord::RecordInvalid => e
    # place!'s state.update! surfaces validation failures here. The old
    # code left this uncaught, which 500'd the request and lit the
    # client's "Couldn't reach the geocoder" copy for what was really a
    # validation issue (e.g. GeoCoarsen returning nil for out-of-range
    # coords). Return the validation message.
    render json: { error: e.record.errors.full_messages.to_sentence }, status: 422
  rescue => e
    # Last-resort catch so an unexpected exception in the pin-drop path
    # (GeoCoarsen edge case, transient DB issue, etc.) becomes a clean
    # 500 with a log line and a client-consumable body — not an
    # unhandled 500 that reads as "the whole map is down".
    Rails.logger.error("PresenceController#create failed for account #{current_account&.id}: #{e.class} #{e.message}")
    render json: { error: I18n.t('kronk.map.presence.place_failed') }, status: 500
  end

  def destroy
    # Hard delete — nothing about where you were is retained.
    PresenceState.where(account_id: current_account.id).delete_all
    head 204
  end

  private

  # The explicit, leak-proof projection. Everything the client needs to draw a
  # pin + its honesty circle, and nothing beneath the coarsened point.
  def project(state, self_view: false)
    account = state.account

    {
      account_id: account.id.to_s,
      name: account.display_name.presence || account.username,
      handle: account.acct,
      # Avatar is public (it's shown on the profile these mates already see); the
      # people strip needs it to render a face per pin. Mirrors AccountSerializer.
      avatar: full_asset_url(account.avatar_static_url),
      lat: state.lat,
      lng: state.lng,
      precision: state.precision,
      radius: Kronk::GeoCoarsen.radius_for(state.precision),
      label: state.label,
      share_scope: state.share_scope,
      expires_at: state.expires_at.iso8601,
      self: self_view,
    }
  end
end
