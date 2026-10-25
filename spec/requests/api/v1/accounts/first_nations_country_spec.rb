# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/profile.md, Country: the First Nations Country you live on,
# shown under your bio.
RSpec.describe 'First Nations Country on a profile' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:accounts write:accounts') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def save_country(value)
    patch '/api/v1/accounts/update_credentials', headers: headers, params: { first_nations_country: value }
  end

  it 'saves the name, without a trailing "Country", and shows it on the account', :aggregate_failures do
    save_country('  Wurundjeri   Country ')

    expect(response).to have_http_status(200)
    expect(user.account.reload.first_nations_country).to eq 'Wurundjeri'

    get "/api/v1/accounts/#{user.account_id}", headers: headers
    expect(response.parsed_body['first_nations_country']).to eq 'Wurundjeri'
  end

  it 'clears it when sent blank' do
    user.account.update!(first_nations_country: 'Kaurna')

    save_country('')

    expect(user.account.reload.first_nations_country).to be_nil
  end

  it 'refuses a name past the limit' do
    save_country('a' * (Account::FirstNationsCountry::FIRST_NATIONS_COUNTRY_LIMIT + 1))

    expect(response).to have_http_status(422)
  end
end
