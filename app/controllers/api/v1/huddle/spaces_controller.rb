# frozen_string_literal: true

# A space's own Kuddle (docs/spaces/huddle.md, A space's own Kuddle).
#
#   GET  /api/v1/huddle/spaces?krew_id=  — the Krew's Kuddles: its own and
#     its projekts' and Komponents', each with where it's from. Members only.
#   POST /api/v1/huddle/spaces  { krew_id } or { project_id } — the space's
#     own Kuddle, made the first time (Konnect → Kuddle). Members only.
class Api::V1::Huddle::SpacesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }, only: [:index]
  before_action -> { doorkeeper_authorize! :write }, only: [:create]
  before_action :require_user!

  def index
    krew = Krew.find(params.require(:krew_id))
    return render json: { error: 'members only' }, status: 403 unless krew.member?(current_account)

    tops = Freethedream::Project.where(krew_id: krew.id, parent_id: nil).pluck(:id)
    projects = tops + Freethedream::Project.where(root_id: tops).pluck(:id)
    rooms = HuddleSession.spaces.not_retired.where(krew_id: krew.id)
                         .or(HuddleSession.spaces.not_retired.where(freethedream_project_id: projects))
                         .includes(:krew, :freethedream_project).to_a
    rooms = rooms.select { |room| room.open_to?(current_account) }
                 .sort_by { |room| [room.krew_id ? 0 : 1, -(room.last_active_at || room.created_at).to_f] }

    render json: rooms, each_serializer: REST::HuddleRoomSerializer,
           follow_states: Huddle::Follows.state_for(current_account, rooms)
  end

  def create
    space = requested_space
    return render json: { error: 'members only' }, status: 403 unless space&.member?(current_account)

    render json: HuddleSession.for_space!(space, current_account), serializer: REST::HuddleRoomSerializer
  end

  private

  def requested_space
    if params[:krew_id].present?
      Krew.active.find_by(id: params[:krew_id])
    elsif params[:project_id].present?
      Freethedream::Project.find_by(id: params[:project_id])
    end
  end
end
