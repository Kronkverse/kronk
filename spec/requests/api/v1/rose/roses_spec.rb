# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Rose API' do
  let(:user)    { Fabricate(:user) }
  let(:account) { user.account }
  let(:mate)    { Fabricate(:account) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:accounts write:follows') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  before do
    account.follow!(mate)
    mate.follow!(account)
  end

  describe 'GET /api/v1/rose/roses' do
    it "returns today's roses with their senders" do
      Fabricate(:rose, from_account: mate, to_account: account)

      get '/api/v1/rose/roses', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body.size).to eq 1
      expect(response.parsed_body.first[:from_account][:id]).to eq mate.id.to_s
    end

    it 'does not return yesterday\'s roses' do
      Fabricate(:rose, from_account: mate, to_account: account, sent_on: Rose.current_day - 1)

      get '/api/v1/rose/roses', headers: headers

      expect(response.parsed_body).to be_empty
    end

    it 'returns roses the account has sent when asked for that direction' do
      Fabricate(:rose, from_account: account, to_account: mate)

      get '/api/v1/rose/roses', params: { direction: 'sent' }, headers: headers

      expect(response.parsed_body.size).to eq 1
      expect(response.parsed_body.first[:to_account][:id]).to eq mate.id.to_s
    end
  end

  describe 'POST /api/v1/rose/roses' do
    it 'sends a rose to a Mate' do
      expect { post '/api/v1/rose/roses', params: { to_account_id: mate.id }, headers: headers }
        .to change(Rose, :count).by(1)

      expect(response).to have_http_status(201)
    end

    it 'refuses a second rose the same day' do
      post '/api/v1/rose/roses', params: { to_account_id: mate.id }, headers: headers
      post '/api/v1/rose/roses', params: { to_account_id: mate.id }, headers: headers

      expect(response).to have_http_status(409)
    end

    it 'refuses a rose to someone who is not a Mate' do
      stranger = Fabricate(:account)

      post '/api/v1/rose/roses', params: { to_account_id: stranger.id }, headers: headers

      expect(response).to have_http_status(403)
    end
  end
end
