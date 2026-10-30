# frozen_string_literal: true

# Map — the people on a First Nations Country (docs/spaces/map.md, First
# Nations Country): the Mates who say on their profile they were born on it or
# live on it, shown on the Country's card.
#
#   GET /api/v1/map/country_people?names[]=Kaurna&names[]=Gaurna
#       { born: [person], living: [person] }
#
# The card sends every name the Country answers to (its own, the others
# written on it, Kronk's list and the open list), so this doesn't have to know
# the shapes. Names match as the map matches them (MapCountryName.fold). It
# says nothing the profiles don't already show.
class Api::V1::Map::CountryPeopleController < Api::BaseController
  include RoutingHelper

  # Enough faces for a card; the rest are a search away.
  LIMIT = 40
  NAMES_LIMIT = 30

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }
  before_action :require_user!

  def index
    wanted = Array(params[:names]).first(NAMES_LIMIT).map { |name| MapCountryName.fold(name) }.compact_blank.to_set
    return render json: { born: [], living: [] } if wanted.empty?

    base = Account.local.searchable.without_silenced
    people = base.where.not(first_nations_country: nil).or(base.where.not(first_nations_country_born: nil)).order(:id).to_a

    render json: {
      born: on(people, :first_nations_country_born, wanted),
      living: on(people, :first_nations_country, wanted),
    }
  end

  private

  def on(people, field, wanted)
    people.select { |account| wanted.include?(MapCountryName.fold(account[field])) }.first(LIMIT).map { |account| serialize(account) }
  end

  def serialize(account)
    {
      id: account.id.to_s,
      acct: account.acct,
      name: account.display_name.presence || account.username,
      avatar: full_asset_url(account.avatar_static_url),
    }
  end
end
