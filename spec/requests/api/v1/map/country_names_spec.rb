# frozen_string_literal: true

require 'rails_helper'

# The open list of First Nations Country names (docs/spaces/map.md, First
# Nations Country): names typed on profiles join it, anyone adds another name
# to a Country on the map, and only a steward takes one off.
RSpec.describe 'Map Country names' do
  let(:user)    { Fabricate(:user) }
  let(:steward) { Fabricate(:moderator_user) }

  def headers_for(someone)
    token = Fabricate(:accessible_access_token, resource_owner_id: someone.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  it 'adds a name typed on a profile to the list' do
    user.account.update!(first_nations_country_born: 'Woiwurrung Country')

    get '/api/v1/map/country_names', headers: headers_for(user)

    expect(response.parsed_body).to contain_exactly(include('name' => 'Woiwurrung', 'shape_id' => nil, 'added_by' => include('acct' => user.account.acct)))
  end

  it 'lets anyone add another name to a Country on the map', :aggregate_failures do
    post '/api/v1/map/country_names', headers: headers_for(user), params: { name: 'Boonwurrung', shape_id: 12 }

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to include('name' => 'Boonwurrung', 'shape_id' => 12, 'can_remove' => false)
  end

  it 'gives a name already on the list its Country, as one name however it is spelt' do
    user.account.update!(first_nations_country: 'Yolngu')

    post '/api/v1/map/country_names', headers: headers_for(user), params: { name: 'Yolŋu', shape_id: 40 }

    expect(MapCountryName.sole).to have_attributes(name: 'Yolngu', shape_id: 40)
  end

  it 'asks which Country a name belongs to' do
    post '/api/v1/map/country_names', headers: headers_for(user), params: { name: 'Boonwurrung' }

    expect(response).to have_http_status(422)
  end

  describe 'taking a name off' do
    let!(:name) { MapCountryName.create!(name: 'Wrong name', shape_id: 3, account: user.account) }

    it 'is refused to anyone but a steward', :aggregate_failures do
      delete "/api/v1/map/country_names/#{name.id}", headers: headers_for(user)

      expect(response).to have_http_status(403)
      expect(name.reload).to_not be_removed
    end

    it 'keeps it off the list once a steward takes it off', :aggregate_failures do
      delete "/api/v1/map/country_names/#{name.id}", headers: headers_for(steward)

      expect(response).to have_http_status(200)
      expect(name.reload).to have_attributes(removed?: true, removed_by_account: steward.account)

      post '/api/v1/map/country_names', headers: headers_for(user), params: { name: 'Wrong Name', shape_id: 3 }
      expect(response).to have_http_status(422)

      get '/api/v1/map/country_names', headers: headers_for(user)
      expect(response.parsed_body).to be_empty
    end
  end
end
