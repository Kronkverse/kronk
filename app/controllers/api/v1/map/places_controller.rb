# frozen_string_literal: true

# Map — Places, the exact spots a location Konnects to (docs/spaces/map.md,
# Places).
#
#   GET    /api/v1/map/places        ?bbox=<west>,<south>,<east>,<north>
#                                    | ?near=<lat>,<lng>[&radius_km=<n>]
#                                    [&q=<name or address>][&limit=<n>]
#   GET    /api/v1/map/places/:id
#   POST   /api/v1/map/places        { name, address?, latitude, longitude }
#                                    or { name, address } to find the spot
#   PATCH  /api/v1/map/places/:id    the maker only
#   DELETE /api/v1/map/places/:id    the maker only
#
# A Place is seen by whoever can see something Konnected to it, and its
# maker (MapPlace#visible_to?). One you can't see answers 404 everywhere,
# as if it weren't there, so a guessed id says nothing. Anyone can make one.
class Api::V1::Map::PlacesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:index, :show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:create, :update, :destroy]
  before_action :require_user!
  before_action :set_place, only: [:show, :update, :destroy]
  before_action :require_maker!, only: [:update, :destroy]

  DEFAULT_LIMIT = 100
  MAX_LIMIT = 200
  DEFAULT_RADIUS_KM = 5.0
  MAX_RADIUS_KM = 200.0
  KM_PER_DEGREE = 111.32

  def index
    scope = MapPlace.order(created_at: :desc)
    scope = scope.within(**bbox) if bbox
    scope = scope.within(**near_box) if near_box
    scope = scope.matching(params[:q]) if params[:q].present?

    places = MapPlace.visible_among(scope.includes(:account), current_account, limit: limit)
    render json: places.map { |place| serialize(place) }
  end

  def show
    render json: serialize(@place)
  end

  def create
    place = MapPlace.new(place_params.merge(account: current_account))
    return render json: { error: "Couldn't find that address on the map" }, status: 422 unless locate(place)

    if place.save
      render json: serialize(place)
    else
      render json: { error: place.errors.full_messages.first }, status: 422
    end
  end

  def update
    if @place.update(place_params)
      render json: serialize(@place)
    else
      render json: { error: @place.errors.full_messages.first }, status: 422
    end
  end

  def destroy
    @place.destroy!
    render_empty
  end

  private

  def set_place
    @place = MapPlace.find_by(id: params[:id])
    render json: { error: 'Place not found' }, status: 404 unless @place&.visible_to?(current_account)
  end

  def require_maker!
    render json: { error: 'Only whoever made this place can change it' }, status: 403 unless @place.account_id == current_account.id
  end

  def place_params
    params.permit(:name, :address, :latitude, :longitude)
  end

  # A Place sent with a name and an address but no point gets the first
  # spot the geocoder finds for the address. False when there's nothing to
  # go on, or the address isn't found.
  def locate(place)
    return true if place.latitude.present? && place.longitude.present?
    return false if place.address.blank?

    found = Kronk::Geocoder.search(place.address).first
    return false unless found

    place.latitude = found[:lat]
    place.longitude = found[:lng]
    true
  end

  # `bbox=<west>,<south>,<east>,<north>`, the order map libraries give it.
  def bbox
    return @bbox if defined?(@bbox)

    west, south, east, north = numbers(params[:bbox], 4)
    @bbox = west && { south: south, west: west, north: north, east: east }
  end

  # `near=<lat>,<lng>` within `radius_km`, as a box around the point.
  def near_box
    return @near_box if defined?(@near_box)

    lat, lng = numbers(params[:near], 2)
    @near_box = lat && begin
      radius = params[:radius_km].present? ? params[:radius_km].to_f.clamp(0.1, MAX_RADIUS_KM) : DEFAULT_RADIUS_KM
      dlat = radius / KM_PER_DEGREE
      dlng = radius / (KM_PER_DEGREE * [Math.cos(lat * Math::PI / 180).abs, 0.01].max)
      # Past ±180 the box wraps, which `within` reads as west > east.
      west = lng - dlng
      east = lng + dlng
      west += 360 if west < -180
      east -= 360 if east > 180
      { south: lat - dlat, west: west, north: lat + dlat, east: east }
    end
  end

  def numbers(raw, count)
    values = raw.to_s.split(',').map { |v| Float(v.strip, exception: false) }
    values.size == count && values.all? { |v| v&.finite? } ? values : [nil] * count
  end

  def limit
    n = params[:limit].to_i
    n.positive? ? [n, MAX_LIMIT].min : DEFAULT_LIMIT
  end

  def serialize(place)
    {
      id: place.id.to_s,
      name: place.name,
      address: place.address,
      latitude: place.latitude.to_f,
      longitude: place.longitude.to_f,
      url: Kronk::KornerRecords.path_for('map', place),
      maker: place.account && {
        id: place.account.id.to_s,
        acct: place.account.acct,
        display_name: place.account.display_name.presence || place.account.username,
      },
      is_owner: place.account_id == current_account.id,
      created_at: place.created_at.iso8601,
    }
  end
end
