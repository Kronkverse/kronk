# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/klot.md: the owner's own cycle ("My cycle").
RSpec.describe 'Klot self' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/klot/self' do
    it 'answers with defaults and no logs for someone who has never used it' do
      get '/api/v1/klot/self', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('cycle_length', 'period_length', 'logs' => [])
    end
  end

  describe 'POST /api/v1/klot/self/logs' do
    it 'records a period start and returns the day of the cycle' do
      post '/api/v1/klot/self/logs', params: { started_on: 2.days.ago.to_date.iso8601 }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('day_of_cycle' => 3)
      expect(response.parsed_body['logs'].size).to eq(1)
    end
  end

  describe 'PATCH /api/v1/klot/self/settings' do
    it 'saves the cycle length' do
      patch '/api/v1/klot/self/settings', params: { cycle_length: 30 }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('cycle_length' => 30)
    end
  end
end
