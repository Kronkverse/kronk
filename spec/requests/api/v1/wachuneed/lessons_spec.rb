# frozen_string_literal: true

require 'rails_helper'

# Lessons (docs/spaces/wachuneed.md, Lessons): a listing whose lesson stays
# locked until the seller accepts someone's request to unlock it. Kronk
# takes no payment; the seller decides who gets in.
RSpec.describe 'Wachuneed lessons' do
  let(:seller_user)   { Fabricate(:user) }
  let(:buyer_user)    { Fabricate(:user) }
  let(:stranger_user) { Fabricate(:user) }
  let(:seller)        { seller_user.account }
  let(:buyer)         { buyer_user.account }
  let(:scopes)        { 'read write read:statuses write:statuses' }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes)
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def lesson_as(user, listing)
    get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers_for(user)
    response.parsed_body['lesson']
  end

  def post_lesson(**params)
    video = Fabricate(:media_attachment, account: seller, status: nil)
    cover = Fabricate(:media_attachment, account: seller, status: nil)
    post '/api/v1/wachuneed/listings', headers: headers_for(seller_user), params: {
      title: 'Fingerpicking, lesson one', description: 'The thumb keeps time.', category: 'service',
      state: 'live', ongoing: true, offering: 'lesson', price_type: 'fixed', price_cents: 2500,
      lesson_body: 'Start slow.', pay_details: 'PayID 0400 000 000', media_attachment_ids: [cover.id],
      lesson_media_ids: [video.id], **params
    }
    expect(response).to have_http_status(200)
    [Listing.find(response.parsed_body['id']), video, cover]
  end

  it 'shows a locked lesson as a preview, never its text or uploads' do
    listing, video, cover = post_lesson

    lesson = lesson_as(buyer_user, listing)
    expect(lesson).to include('open' => false, 'unlocked' => false, 'has_text' => true)
    expect(lesson.keys).to_not include('body', 'media')
    expect(response.parsed_body['pay_details']).to eq('PayID 0400 000 000')
    expect(response.parsed_body['photos'].pluck('id')).to eq([cover.id.to_s])
    expect(response.body).to_not include(video.file.url(:original))
  end

  it 'opens for the seller, and for a buyer once the seller accepts their request' do
    allow(Kronk::KornerEvents).to receive(:publish)
    listing, video, = post_lesson

    expect(lesson_as(seller_user, listing)['media'].pluck('id')).to eq([video.id.to_s])

    post "/api/v1/wachuneed/listings/#{listing.id}/requests", headers: headers_for(buyer_user), params: { message: 'Paid by PayID' }
    expect(response).to have_http_status(200)
    expect(Kronk::KornerEvents).to have_received(:publish).with('wachuneed.offer.made', hash_including(recipient_account_id: seller.id))
    request_id = response.parsed_body['id']
    expect(lesson_as(buyer_user, listing)['unlocked']).to be(false)

    post "/api/v1/wachuneed/requests/#{request_id}/accept", headers: headers_for(seller_user)
    expect(response).to have_http_status(200)

    lesson = lesson_as(buyer_user, listing)
    expect(lesson).to include('unlocked' => true, 'body' => 'Start slow.')
    expect(lesson['media'].pluck('id')).to eq([video.id.to_s])
    expect(listing.reload.state).to eq('live')
    expect(lesson_as(stranger_user, listing)['unlocked']).to be(false)

    post "/api/v1/wachuneed/listings/#{listing.id}/requests", headers: headers_for(buyer_user)
    expect(response).to have_http_status(422)
  end

  it 'stays locked when the seller declines' do
    allow(Kronk::KornerEvents).to receive(:publish)
    listing, = post_lesson
    post "/api/v1/wachuneed/listings/#{listing.id}/requests", headers: headers_for(buyer_user)
    post "/api/v1/wachuneed/requests/#{response.parsed_body['id']}/decline", headers: headers_for(seller_user)

    expect(lesson_as(buyer_user, listing)['unlocked']).to be(false)
    get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers_for(buyer_user)
    expect(response.parsed_body['my_request']).to include('state' => 'declined')
  end

  it 'is open to everyone who can see it when free or for a donation, with nothing to ask' do
    listing, = post_lesson(price_type: 'donation', price_cents: nil)

    expect(listing.price_cents).to be_nil
    expect(lesson_as(stranger_user, listing)).to include('open' => true, 'unlocked' => true, 'body' => 'Start slow.')

    post "/api/v1/wachuneed/listings/#{listing.id}/requests", headers: headers_for(buyer_user)
    expect(response).to have_http_status(422)
  end

  it 'keeps what someone says they will pay for a Pay what you want lesson' do
    allow(Kronk::KornerEvents).to receive(:publish)
    listing, = post_lesson(price_type: 'offers', price_cents: nil)

    post "/api/v1/wachuneed/listings/#{listing.id}/requests", headers: headers_for(buyer_user), params: { amount_cents: 1500 }
    expect(response.parsed_body).to include('amount_cents' => 1500)
    expect(response.parsed_body['listing']).to include('offering' => 'lesson')
  end

  it 'stays locked to someone who cannot see the listing, even if once let in' do
    allow(Kronk::KornerEvents).to receive(:publish)
    listing, = post_lesson
    post "/api/v1/wachuneed/listings/#{listing.id}/requests", headers: headers_for(buyer_user)
    post "/api/v1/wachuneed/requests/#{response.parsed_body['id']}/accept", headers: headers_for(seller_user)

    listing.update!(visibility: :self_only)
    expect(listing.lesson_unlocked_for?(buyer)).to be(false)
  end

  it 'replaces the uploads when an edit sends them, and drops lesson text from anything else' do
    listing, video, = post_lesson
    other = Fabricate(:media_attachment, account: seller, status: nil)

    patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers_for(seller_user), params: { lesson_media_ids: [other.id, video.id] }
    expect(listing.reload.listing_lesson_media.map(&:media_attachment_id)).to eq([other.id, video.id])

    patch "/api/v1/wachuneed/listings/#{listing.id}", headers: headers_for(seller_user), params: { lesson_body: 'Kept' }
    expect(listing.reload.listing_lesson_media.size).to eq(2)

    plain = Listing.create!(account: seller, title: 'Chair', category: 'goods', state: 'live', lesson_body: 'Nope')
    expect(plain.lesson_body).to be_nil
  end
end
