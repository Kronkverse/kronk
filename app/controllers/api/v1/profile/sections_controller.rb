# frozen_string_literal: true

# Manages the sectioned-profile ordering + composition per §Profile.
#
#   GET    /api/v1/profile/sections           # current account's sections in order
#   POST   /api/v1/profile/sections           # append a new section
#   PATCH  /api/v1/profile/sections/reorder   # replace all positions (payload: {order: [id, id, ...]})
#   PATCH  /api/v1/profile/sections/:id       # update title/visible/settings on one section
#   DELETE /api/v1/profile/sections/:id       # remove a section (timeline cannot be deleted)
class Api::V1::Profile::SectionsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :update, :destroy, :reorder]
  before_action :require_user!

  def index
    render json: sections_scope, each_serializer: REST::ProfileSectionSerializer
  end

  def create
    section = current_account.profile_sections.new(section_params)
    section.position = next_position

    if section.save
      render json: section, serializer: REST::ProfileSectionSerializer
    else
      render json: { error: section.errors.full_messages.join(', ') }, status: 422
    end
  end

  def update
    section = current_account.profile_sections.find(params[:id])

    if section.update(section_update_params)
      render json: section, serializer: REST::ProfileSectionSerializer
    else
      render json: { error: section.errors.full_messages.join(', ') }, status: 422
    end
  end

  def destroy
    section = current_account.profile_sections.find(params[:id])

    return render json: { error: 'timeline section is not removable' }, status: 422 if section.section_type == 'timeline'

    section.destroy!
    render json: { ok: true }
  end

  def reorder
    ids = Array(params[:order]).map(&:to_s)
    owned = current_account.profile_sections.where(id: ids).index_by(&:id)

    return render json: { error: 'unknown section ids' }, status: 422 if owned.size != ids.size

    ProfileSection.transaction do
      ids.each_with_index do |id, i|
        owned[id.to_i]&.update!(position: i)
      end
    end

    render json: sections_scope, each_serializer: REST::ProfileSectionSerializer
  end

  private

  def sections_scope
    current_account.profile_sections.ordered
  end

  def next_position
    (current_account.profile_sections.maximum(:position) || -1) + 1
  end

  def section_params
    params.permit(:section_type, :title, :visible, settings: {})
  end

  def section_update_params
    params.permit(:title, :visible, settings: {})
  end
end
