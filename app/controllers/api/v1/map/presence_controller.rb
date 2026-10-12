# frozen_string_literal: true

# Map — presence. Opt-in, coarsened location (docs/spaces/map.md).
#
#   GET    /api/v1/map/presence       — pins visible to me right now
#   GET    /api/v1/map/presence/self  — my own pin (or null)
#   POST   /api/v1/map/presence       — place / re-place me
#   DELETE /api/v1/map/presence       — remove me (hard delete)
#   POST   /api/v1/map/presence/:account_id/challenge
#                                     — tell a Mate their pin looks out of date
#
# The `index` action IS the privacy contract (mirrors Klot's CircleController):
# it returns an explicit hash per row and never anything beneath the already-
# coarsened point — no serializer, no `include :account` leaking fields. The
# `friends` scope is Mates-gated (mutual follow), not one-way following.
class Api::V1::Map::PresenceController < Api::BaseController
  # `full_asset_url` (used in `project` to expand the avatar URL) lives
  # in RoutingHelper. Api::BaseController inherits from
  # ActionController::API, which does NOT auto-include app helpers, so
  # the call fell through to NoMethodError. Every serializer that needs
  # `full_asset_url` includes RoutingHelper explicitly (see
  # rest/account_serializer.rb, rest/media_attachment_serializer.rb,
  # rest/notification_group_serializer.rb) — mirror that here since
  # this controller builds its projection inline rather than through a
  # serializer.
  include RoutingHelper
  include Redisable

  # How often one person can challenge another's pin. The mark is a Redis key
  # with this lifetime and nothing else: no table, and no record of who
  # challenged whom once the week is up.
  CHALLENGE_EVERY = 7.days

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :destroy, :challenge]
  before_action :require_user!

  def index
    # Mates-only presence (Tal 2026-08-10 — "only visible to mates,
    # never Kronkverse-wide"). The `kommunity` scope stays in the DB
    # enum for legacy rows but is no longer surfaced anywhere — the
    # composer never sends it, the API contract drops it, and this
    # scope query no longer OR-ins those rows.
    visible = visible_pins.includes(:account)

    challenged = challenged_ids(visible.map(&:account_id))

    render json: visible.map { |state| project(state, challenged: challenged.include?(state.account_id)) }
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
      note: params[:note],
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

  # "Your pin looks out of date" (Tal 2026-10-12, Kommons proposal "Challenge
  # someones location"). Only for a pin the caller can already see, so it
  # reveals nothing: the same Mates gate as `index`. The person gets a named
  # notification in Nudges that opens the Map on its place search. At most
  # once a week per person, so it cannot be used to pester.
  def challenge
    state = visible_pins.find_by(account_id: params[:account_id])
    return render(json: { error: 'not_found' }, status: 404) unless state

    fresh = redis.set(challenge_key(state.account_id), Time.now.utc.to_i, nx: true, ex: CHALLENGE_EVERY.to_i)
    return render(json: { error: 'already_challenged' }, status: 409) unless fresh

    Kronk::KornerEvents.publish(
      'map.pin.challenged',
      actor_account_id: current_account.id,
      recipient_account_id: state.account_id
    )
    head 204
  end

  private

  # The pins the caller is allowed to see: their Mates' live ones.
  def visible_pins
    PresenceState.active
                 .where.not(account_id: current_account.id)
                 .where(share_scope: :friends, account_id: current_account.mates.select(:id))
  end

  def challenge_key(account_id)
    "map:challenge:#{current_account.id}:#{account_id}"
  end

  # Which of these people the caller has challenged in the last week.
  def challenged_ids(account_ids)
    return [] if account_ids.empty?

    marks = redis.mget(*account_ids.map { |id| challenge_key(id) })
    account_ids.zip(marks).filter_map { |id, mark| id if mark }
  end

  # The explicit, leak-proof projection. Everything the client needs to draw a
  # pin + its honesty circle, and nothing beneath the coarsened point.
  def project(state, self_view: false, challenged: false)
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
      note: state.note,
      share_scope: state.share_scope,
      # `placed_at` only advances when the stored coordinate changes —
      # so a note edit doesn't reset the pin card's "Here since" line.
      # Old rows that predate the column read as `created_at` so they
      # still surface a plausible date rather than nothing.
      placed_at: (state.placed_at || state.created_at).iso8601,
      expires_at: state.expires_at.iso8601,
      self: self_view,
      # The caller has asked this person to update their pin this week.
      challenged: challenged,
    }
  end
end
