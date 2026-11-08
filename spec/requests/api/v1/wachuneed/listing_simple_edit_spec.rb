# frozen_string_literal: true

require 'rails_helper'

# The listing composer sends only photos, name, description, price and who
# can see it (decisions.md, 2026-11-08). An edit through it must leave
# everything else a listing has as it was.
RSpec.describe 'Editing a listing with the simple composer' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let(:shop)    { ListingShop.create!(account: user.account, name: 'Clay Co') }
  let(:section) { shop.sections.create!(name: 'Mugs') }
  let(:listing) do
    Listing.create!(
      account: user.account, title: 'Mug', description: 'Glazed', category: 'creation', state: 'live',
      price_cents: 2000, price_currency: 'AUD', listing_shop_section: section,
      availability: 'made_to_order', ongoing: true, announced: false,
      options: [{ name: 'Glaze', choices: [{ label: 'Blue' }, { label: 'Green', extra_cents: 500 }] }],
      booking: { template: 'appointment', parts: %w(time), minutes: 60, hours: [{ day: 1, from: '09:00', to: '17:00' }] }
    )
  end

  it 'changes only the name, description and price' do
    before = listing.reload.attributes.slice('options', 'variants', 'booking', 'availability', 'ongoing', 'announced',
                                             'listing_shop_section_id', 'category', 'kind', 'state')

    patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers, as: :json,
                                                      params: { title: 'Big mug', description: 'Glazed inside', price_cents: 2500, price_currency: 'AUD',
                                                                visibility: 'public', krew_ids: [] }

    expect(response).to have_http_status(200)
    listing.reload
    expect(listing).to have_attributes(title: 'Big mug', description: 'Glazed inside', price_cents: 2500)
    expect(listing.attributes.slice(*before.keys)).to eq before
  end

  it 'makes a listing with only a name' do
    post '/api/v1/wachuneed/listings', headers: headers, as: :json,
                                       params: { title: 'Spare chair', category: 'goods', kind: 'offer', state: 'live', price_cents: nil, visibility: 'public', krew_ids: [] }

    expect(response).to have_http_status(200)
    expect(Listing.find(response.parsed_body['id'])).to have_attributes(
      title: 'Spare chair', category: 'goods', availability: 'available', ongoing: false, options: [], booking: {}
    )
  end
end
