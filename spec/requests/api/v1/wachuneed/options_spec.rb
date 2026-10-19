# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/wachuneed.md, Options.
RSpec.describe 'Wachuneed listing options' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:massage) do
    [
      { name: 'Length', choices: [{ label: '30 minutes', extra_cents: 0 }, { label: '1 hour', extra_cents: 4000 }] },
      { name: 'Where', choices: [{ label: 'At my place' }, { label: 'At yours', extra_cents: 2000 }] },
    ]
  end

  def create_listing(**params)
    post '/api/v1/wachuneed/listings', headers: headers, as: :json,
                                       params: { title: 'Massage', category: 'service', state: 'live', price_cents: 5000, price_currency: 'AUD' }.merge(params)
    Listing.find(response.parsed_body['id'])
  end

  it 'keeps the options a listing is created with, and serves them on its page' do
    listing = create_listing(options: massage)

    get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers

    expect(response.parsed_body['options']).to eq [
      { 'name' => 'Length', 'choices' => [{ 'label' => '30 minutes', 'extra_cents' => 0 }, { 'label' => '1 hour', 'extra_cents' => 4000 }] },
      { 'name' => 'Where', 'choices' => [{ 'label' => 'At my place', 'extra_cents' => 0 }, { 'label' => 'At yours', 'extra_cents' => 2000 }] },
    ]
  end

  it 'leaves them off the browse grid' do
    create_listing(options: massage)

    get '/api/v1/wachuneed/listings', headers: headers

    expect(response.parsed_body.first).to_not include('options')
  end

  it 'drops what cannot be drawn and holds to the limits' do
    listing = create_listing(options: [
                               { name: ' ', choices: [{ label: 'Nameless' }] },
                               { name: 'Empty', choices: [{ label: '  ' }] },
                               { name: 'Size', choices: [{ label: 'Small', extra_cents: -500 }, { label: 'Huge', extra_cents: 99_999_999_999 }] },
                               *Array.new(8) { |i| { name: "Extra #{i}", choices: [{ label: 'Yes' }] } },
                             ])

    expect(listing.options.size).to eq Listing::MAX_OPTIONS
    expect(listing.options.first).to eq('name' => 'Size', 'choices' => [
                                          { 'label' => 'Small', 'extra_cents' => 0 },
                                          { 'label' => 'Huge', 'extra_cents' => Listing::MAX_OPTION_EXTRA },
                                        ])
  end

  it 'replaces them when an edit sends them, removes them with an empty list, and leaves them otherwise' do
    listing = create_listing(options: massage)

    patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json, params: { title: 'Deep massage' }
    expect(listing.reload.options.pluck('name')).to eq %w(Length Where)

    patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json,
                                                      params: { options: [{ name: 'Style', choices: [{ label: 'Shiatsu' }] }] }
    expect(listing.reload.options.pluck('name')).to eq %w(Style)

    patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json, params: { options: [] }
    expect(listing.reload.options).to eq []
  end

  it 'gives a wanted ad no options' do
    listing = create_listing(kind: 'wanted', options: massage)

    expect(listing.options).to eq []
  end
end
