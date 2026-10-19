# frozen_string_literal: true

require 'rails_helper'

# Requests for a listing (docs/spaces/wachuneed.md, Requests): a buyer asks
# with what they chose, the seller accepts or declines, the buyer can take
# it back while it waits.
RSpec.describe 'Wachuneed requests' do
  let(:buyer_user)   { Fabricate(:user) }
  let(:seller_user)  { Fabricate(:user) }
  let(:buyer)        { buyer_user.account }
  let(:seller)       { seller_user.account }
  let(:scopes)       { 'read write read:statuses write:statuses' }

  let(:item) do
    Listing.create!(
      account: seller, title: 'Wrist cuff', category: 'creation', state: 'live', ongoing: true,
      price_cents: 8000, price_currency: 'AUD',
      variants: {
        'axes' => [{ 'name' => 'Colour', 'values' => %w(Black Brown) }],
        'items' => [
          { 'values' => ['Black'], 'price_cents' => 8000, 'availability' => 'available' },
          { 'values' => ['Brown'], 'price_cents' => 9000, 'availability' => 'sold_out' },
        ],
      },
      options: [{ 'name' => 'Wrapping', 'choices' => [{ 'label' => 'Gift wrap', 'extra_cents' => 500 }] }]
    )
  end

  before do
    buyer.follow!(seller)
    seller.follow!(buyer)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes)
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def ask(**params)
    post "/api/v1/wachuneed/listings/#{item.id}/requests", headers: headers_for(buyer_user), params: params
  end

  it 'keeps what was chosen and the total, and tells the seller' do
    allow(Kronk::KornerEvents).to receive(:publish)

    ask(variant: ['Black'], options: [{ name: 'Wrapping', choice: 'Gift wrap' }], quantity: 2, message: 'For my sister')

    expect(Kronk::KornerEvents).to have_received(:publish)
      .with('wachuneed.offer.made', hash_including(actor_account_id: buyer.id, recipient_account_id: seller.id))

    expect(response).to have_http_status(200)
    body = response.parsed_body
    expect(body['state']).to eq 'pending'
    expect(body['quantity']).to eq 2
    expect(body['total_cents']).to eq 17_000
    expect(body['choices']['variant']).to eq ['Black']
    expect(body['choices']['options']).to eq [{ 'name' => 'Wrapping', 'choice' => 'Gift wrap', 'extra_cents' => 500 }]
  end

  it 'refuses a kind that is sold out, an extra that is not offered, and asking twice' do
    ask(variant: ['Brown'])
    expect(response).to have_http_status(422)

    ask(variant: ['Black'], options: [{ name: 'Wrapping', choice: 'Ribbon' }])
    expect(response).to have_http_status(422)

    ask(variant: ['Black'])
    expect(response).to have_http_status(200)
    ask(variant: ['Black'])
    expect(response).to have_http_status(422)
  end

  it 'refuses your own listing' do
    post "/api/v1/wachuneed/listings/#{item.id}/requests", headers: headers_for(seller_user), params: { variant: ['Black'] }
    expect(response).to have_http_status(422)
  end

  it 'lets the seller accept once, and keeps an ongoing item up' do
    ask(variant: ['Black'])
    id = response.parsed_body['id']

    post "/api/v1/wachuneed/requests/#{id}/accept", headers: headers_for(buyer_user)
    expect(response).to have_http_status(403)

    post "/api/v1/wachuneed/requests/#{id}/accept", headers: headers_for(seller_user)
    expect(response.parsed_body['state']).to eq 'accepted'
    expect(item.reload.state).to eq 'live'

    post "/api/v1/wachuneed/requests/#{id}/decline", headers: headers_for(seller_user)
    expect(response).to have_http_status(422)
  end

  it 'reserves a one-off when accepted' do
    item.update!(ongoing: false)
    ask(variant: ['Black'])
    post "/api/v1/wachuneed/requests/#{response.parsed_body['id']}/accept", headers: headers_for(seller_user)

    expect(item.reload.state).to eq 'reserved'
  end

  it 'lets the buyer take it back, and lists requests for each side' do
    ask(variant: ['Black'])
    id = response.parsed_body['id']

    post "/api/v1/wachuneed/requests/#{id}/withdraw", headers: headers_for(buyer_user)
    expect(response.parsed_body['state']).to eq 'withdrawn'

    get '/api/v1/wachuneed/requests', headers: headers_for(seller_user)
    expect(response.parsed_body.pluck('id')).to eq [id]
    expect(response.parsed_body.first['buyer']['id']).to eq buyer.id.to_s

    get '/api/v1/wachuneed/requests', headers: headers_for(buyer_user), params: { as: 'buyer' }
    expect(response.parsed_body.pluck('id')).to eq [id]
  end

  it 'hides a request from anyone not party to it' do
    ask(variant: ['Black'])
    stranger = Fabricate(:user)

    post "/api/v1/wachuneed/requests/#{response.parsed_body['id']}/decline", headers: headers_for(stranger)
    expect(response).to have_http_status(404)
  end
end
