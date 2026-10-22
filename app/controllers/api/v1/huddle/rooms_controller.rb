# frozen_string_literal: true

# Open Huddle Rooms — the third scope alongside Main and Krew (see
# docs/spaces/huddle.md § Three categories).
#
# Endpoints:
#   GET  /api/v1/huddle/rooms  — list live, non-retired rooms
#     ordered by activity (occupancy → most-recent activity)
#   POST /api/v1/huddle/rooms  — create a new Room (any signed-in user):
#     name, description, and optionally krew_id, a Krew the creator is in,
#     which the new Room is Konnected (linked) to. The Room stays open.
#   POST /api/v1/huddle/rooms/:id/join — mark a Room active as someone enters
class Api::V1::Huddle::RoomsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }, only: [:index]
  before_action -> { doorkeeper_authorize! :write }, only: [:create, :join]
  before_action :require_user!

  def index
    # Newest activity first — a Room with a session going right now
    # should be visible above one that hasn't seen anyone in a week.
    # `last_active_at NULLS LAST` covers the edge case where a Room
    # was created but nobody has joined yet.
    @rooms = HuddleSession
             .rooms
             .not_retired
             .order(Arel.sql('last_active_at DESC NULLS LAST'))
             .limit(100)

    render json: @rooms, each_serializer: REST::HuddleRoomSerializer
  end

  # POST /api/v1/huddle/rooms/:id/join — someone went into the Room. Marks
  # it active, which is what keeps the reaper away and sorts the list; it
  # used to be set only at creation, so busy Rooms retired after six months.
  def join
    room = HuddleSession.rooms.not_retired.find(params[:id])
    room.bump_activity!
    render json: room, serializer: REST::HuddleRoomSerializer
  end

  def create
    krew = linked_krew
    return render json: { error: 'you can only Konnect a Room to a Krew you are in' }, status: 422 if krew == false

    room = HuddleRoom::CreateService.new.call(
      account: current_account,
      name: params[:name],
      description: params[:description],
      krew: krew
    )

    render json: room, serializer: REST::HuddleRoomSerializer
  rescue ArgumentError => e
    render json: { error: e.message }, status: 422
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: 422
  end

  private

  # The Krew named by `krew_id`: nil when none was asked for, false when it
  # isn't a live Krew the creator is a member of (one answer for both, so a
  # guessed id says nothing about what exists).
  def linked_krew
    return nil if params[:krew_id].blank?

    krew = Krew.active.find_by(id: params[:krew_id])
    krew&.member?(current_account) ? krew : false
  end
end
