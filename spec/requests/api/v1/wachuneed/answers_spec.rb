# frozen_string_literal: true

require 'rails_helper'

# Answering a wanted ad (docs/spaces/wachuneed.md, Answering a wanted ad):
# someone who can do it says so with their price, the poster chooses one or
# says no thanks, and once the ad has the people it wants it is taken.
RSpec.describe 'Wachuneed answers' do
  let(:poster_user) { Fabricate(:user) }
  let(:poster)      { poster_user.account }
  let(:scopes)      { 'read write read:statuses write:statuses' }

  let(:job) do
    Listing.create!(account: poster, title: 'A gardener', category: 'service', kind: 'wanted', state: 'live',
                    looking_for: 'job', price_cents: 3800, price_currency: 'AUD', price_unit: 'hour')
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes)
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def answer(user, **params)
    post "/api/v1/wachuneed/listings/#{job.id}/requests", headers: headers_for(user),
                                                          params: { message: 'Ten years of veggie gardens', **params }
  end

  it 'takes an answer with a price, tells the poster, and counts it for everyone' do
    helper = Fabricate(:user)

    expect { answer(helper, amount_cents: 4000) }.to change(ListingOffer, :count).by(1)

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to include('pitch' => true, 'amount_cents' => 4000, 'state' => 'pending')
    expect(response.parsed_body['listing']).to include('kind' => 'wanted', 'price_unit' => 'hour')

    get "/api/v1/wachuneed/listings/#{job.id}", headers: headers_for(Fabricate(:user))
    expect(response.parsed_body).to include('answers_count' => 1, 'my_answer' => nil)

    get "/api/v1/wachuneed/listings/#{job.id}", headers: headers_for(helper)
    expect(response.parsed_body['my_answer']).to include('state' => 'pending')
  end

  it 'publishes the answer to the poster as wachuneed.pitch.made' do
    allow(Kronk::KornerEvents).to receive(:publish)

    answer(Fabricate(:user))

    expect(Kronk::KornerEvents).to have_received(:publish)
      .with('wachuneed.pitch.made', hash_including(recipient_account_id: poster.id, listing_id: job.id))
  end

  it 'refuses a second answer, an empty one, and one from the poster' do
    helper = Fabricate(:user)
    answer(helper)

    answer(helper)
    expect(response).to have_http_status(422)

    answer(Fabricate(:user), message: 'yes')
    expect(response.parsed_body['error']).to eq 'Say what you would do'

    answer(poster_user)
    expect(response).to have_http_status(422)
  end

  it 'lists the answers to one of your wanted ads' do
    answer(Fabricate(:user))
    other = Listing.create!(account: poster, title: 'A ladder', category: 'goods', kind: 'wanted', state: 'live')
    ListingOffer.pitch(other, offerer: Fabricate(:account), message: 'I have a six rung one').save!

    get '/api/v1/wachuneed/requests', headers: headers_for(poster_user), params: { as: 'seller', listing_id: job.id }

    expect(response.parsed_body.size).to eq 1
    expect(response.parsed_body.first['listing']['id']).to eq job.id.to_s
  end

  describe 'choosing' do
    let(:first_helper)  { Fabricate(:user) }
    let(:second_helper) { Fabricate(:user) }

    before do
      answer(first_helper)
      answer(second_helper)
    end

    it 'takes the ad when the one person it wants is chosen, and the rest hear it went elsewhere' do
      allow(Kronk::KornerEvents).to receive(:publish)
      chosen = ListingOffer.find_by(offerer: first_helper.account)

      post "/api/v1/wachuneed/requests/#{chosen.id}/accept", headers: headers_for(poster_user)

      expect(response.parsed_body['state']).to eq 'accepted'
      expect(job.reload.state).to eq 'reserved'
      expect(ListingOffer.find_by(offerer: second_helper.account).state).to eq 'declined'
      expect(Kronk::KornerEvents).to have_received(:publish)
        .with('wachuneed.pitch.chosen', hash_including(recipient_account_id: first_helper.account.id))
      expect(Kronk::KornerEvents).to have_received(:publish)
        .with('wachuneed.pitch.passed', hash_including(recipient_account_id: second_helper.account.id))
    end

    it 'is marked delivered by whoever was chosen, then done by the poster' do
      allow(Kronk::KornerEvents).to receive(:publish)
      chosen = ListingOffer.find_by(offerer: first_helper.account)
      chosen.accept!

      post "/api/v1/wachuneed/requests/#{chosen.id}/complete", headers: headers_for(first_helper)
      expect(response).to have_http_status(403)

      post "/api/v1/wachuneed/requests/#{chosen.id}/deliver", headers: headers_for(first_helper)
      expect(response.parsed_body['delivered_at']).to be_present
      expect(Kronk::KornerEvents).to have_received(:publish)
        .with('wachuneed.pitch.delivered', hash_including(recipient_account_id: poster.id))

      post "/api/v1/wachuneed/requests/#{chosen.id}/complete", headers: headers_for(poster_user)
      expect(response.parsed_body['completed_at']).to be_present
      expect(Kronk::KornerEvents).to have_received(:publish)
        .with('wachuneed.pitch.done', hash_including(recipient_account_id: first_helper.account.id))
    end

    it 'carries through only a chosen answer' do
      waiting = ListingOffer.find_by(offerer: second_helper.account)

      post "/api/v1/wachuneed/requests/#{waiting.id}/deliver", headers: headers_for(second_helper)

      expect(response).to have_http_status(422)
    end

    it 'keeps an open call up until it has the people it wants' do
      job.update!(spots: 2)

      post "/api/v1/wachuneed/requests/#{ListingOffer.find_by(offerer: first_helper.account).id}/accept", headers: headers_for(poster_user)
      expect(job.reload.state).to eq 'live'

      post "/api/v1/wachuneed/requests/#{ListingOffer.find_by(offerer: second_helper.account).id}/accept", headers: headers_for(poster_user)
      expect(job.reload.state).to eq 'reserved'
    end
  end
end
