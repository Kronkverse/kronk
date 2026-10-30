# frozen_string_literal: true

# Map — the open list of First Nations Country names (docs/spaces/map.md,
# First Nations Country; MapCountryName).
#
#   GET    /api/v1/map/country_names        every name on the list
#   POST   /api/v1/map/country_names        { name, shape_id } another name for
#                                           a Country on the map; anyone
#   DELETE /api/v1/map/country_names/:id    takes it off; a steward only
#
# Names typed on profiles join the list on their own (Account::FirstNations
# Country). Each name says who added it, so the list is accountable.
class Api::V1::Map::CountryNamesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :destroy]
  before_action :require_user!
  before_action :require_steward!, only: [:destroy]

  def index
    names = MapCountryName.listed.includes(:account).order(:name)
    render json: names.map { |name| serialize(name) }
  end

  def create
    shape_id = Integer(params[:shape_id].to_s, exception: false)
    return render json: { error: 'Pick the Country this name belongs to' }, status: 422 if shape_id.nil?

    name = MapCountryName.find_by(folded: MapCountryName.fold(params[:name]))
    return render json: { error: 'That name was taken off the list' }, status: 422 if name&.removed?

    if name
      # Already on the list (typed on a profile, say): this says which Country
      # it is. One already given a Country keeps it.
      name.update!(shape_id: shape_id) if name.shape_id.nil?
    else
      name = MapCountryName.new(name: typed_name, shape_id: shape_id, account: current_account)
      return render json: { error: name.errors.full_messages.first }, status: 422 unless name.save
    end

    render json: serialize(name)
  end

  def destroy
    name = MapCountryName.listed.find_by(id: params[:id])
    return render json: { error: 'Name not found' }, status: 404 unless name

    name.remove!(current_account)
    render_empty
  end

  private

  # The name as typed, without a trailing "Country" (as on a profile). Squished
  # first, so the suffix is matched as plain text.
  def typed_name
    params[:name].to_s.first(MapCountryName::NAME_LIMIT * 2).squish.delete_suffix(' Country').delete_suffix(' country')
  end

  # Stewards look after the list: admins and moderators, as for proposals.
  def steward?
    current_user.role&.can?(:administrator) || current_user.role&.can?(:manage_reports)
  end

  def require_steward!
    render json: { error: 'Only a steward can take a name off the list' }, status: 403 unless steward?
  end

  def serialize(name)
    {
      id: name.id.to_s,
      name: name.name,
      shape_id: name.shape_id,
      added_by: name.account && { id: name.account.id.to_s, acct: name.account.acct },
      can_remove: steward?,
    }
  end
end
