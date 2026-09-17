# frozen_string_literal: true

# Open Huddle Rooms — the third scope alongside Main and Krew (see
# docs/spaces/huddle.md § Three categories).
#
# Endpoints:
#   GET  /api/v1/huddle/rooms  — list live, non-retired rooms
#     ordered by activity (occupancy → most-recent activity)
#   POST /api/v1/huddle/rooms  — create a new Room (any signed-in user)
class Api::V1::Huddle::RoomsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }, only: [:index]
  before_action -> { doorkeeper_authorize! :write }, only: [:create]
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

  def create
    room = HuddleRoom::CreateService.new.call(
      account: current_account,
      name: params[:name],
      description: params[:description],
      icon: params[:icon]
    )

    render json: room, serializer: REST::HuddleRoomSerializer
  rescue ArgumentError => e
    render json: { error: e.message }, status: 422
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: e.record.errors.full_messages.to_sentence }, status: 422
  end
end
