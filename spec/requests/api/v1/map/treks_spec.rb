# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/map.md: Treks. When a trek happened.
RSpec.describe 'Api::V1::Map::Treks' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def log_trek(extra = {})
    post '/api/v1/map/treks', headers: headers, params: { activity_type: 'run', title: 'Morning run', distance_m: 5000, moving_sec: 1800 }.merge(extra)
  end

  describe 'POST /api/v1/map/treks' do
    it 'keeps the day the trek happened' do
      log_trek(recorded_at: '2026-06-01T07:30:00Z')

      expect(response).to have_http_status(200)
      expect(response.parsed_body['recorded_at']).to start_with('2026-06-01T07:30:00')
      expect(Trek.last.recorded_at).to eq Time.utc(2026, 6, 1, 7, 30)
    end

    it 'stamps now when there is no date, a bad one or a future one' do
      [{}, { recorded_at: 'yesterday-ish' }, { recorded_at: 2.days.from_now.iso8601 }].each do |extra|
        log_trek(extra)

        expect(response).to have_http_status(200)
        expect(Trek.last.recorded_at).to be_within(1.minute).of(Time.now.utc)
      end
    end

    it 'logs a motorbike ride as speed, not pace' do
      log_trek(activity_type: 'motorbike', title: 'Bush braap')

      expect(response).to have_http_status(200)
      expect(Trek.last).to have_attributes(activity_type: 'motorbike', pace?: false)
    end
  end

  describe 'POST /api/v1/map/treks/:id/publish' do
    it 'posts the trek without an emoji' do
      log_trek(activity_type: 'ride', title: '')
      post "/api/v1/map/treks/#{Trek.last.id}/publish", headers: headers, params: { visibility: 'mates' }

      expect(response).to have_http_status(200)
      expect(Trek.last.status.text).to eq("Ride\n5.0 km · 30m")
    end
  end
end
