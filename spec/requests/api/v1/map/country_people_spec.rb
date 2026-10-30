# frozen_string_literal: true

require 'rails_helper'

# The people on a First Nations Country (docs/spaces/map.md, First Nations
# Country): those who say on their profile they were born on it or live on it.
RSpec.describe 'Map Country people' do
  let(:user) { Fabricate(:user) }
  let(:headers) do
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  it 'lists who was born on and who lives on a Country, by any of its names', :aggregate_failures do
    born = Fabricate(:account, first_nations_country_born: 'Kaurna')
    living = Fabricate(:account, first_nations_country: 'gaurna country')
    Fabricate(:account, first_nations_country: 'Wiradjuri')

    get '/api/v1/map/country_people', headers: headers, params: { names: %w(Kaurna Gaurna) }

    expect(response).to have_http_status(200)
    expect(response.parsed_body['born']).to contain_exactly(include('acct' => born.acct))
    expect(response.parsed_body['living']).to contain_exactly(include('acct' => living.acct))
  end

  it 'leaves out suspended accounts' do
    Fabricate(:account, first_nations_country: 'Kaurna', suspended: true)

    get '/api/v1/map/country_people', headers: headers, params: { names: ['Kaurna'] }

    expect(response.parsed_body['living']).to be_empty
  end

  it 'needs a sign-in' do
    get '/api/v1/map/country_people', params: { names: ['Kaurna'] }

    expect(response).to have_http_status(401)
  end
end
