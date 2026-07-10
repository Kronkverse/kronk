# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Nudges Activity' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:notifications') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:account) { user.account }

  describe 'GET /api/v1/nudges/activity' do
    it 'returns http success and an array' do
      get api_v1_nudges_activity_index_path, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to be_an(Array)
    end

    it 'excludes legacy notification types' do
      # A mention (legacy) shouldn't appear.
      other = Fabricate(:account)
      status = Fabricate(:status, account: other)
      Fabricate(:notification, account: account, type: :mention, activity: status, from_account: other)

      get api_v1_nudges_activity_index_path, headers: headers

      expect(response.parsed_body.pluck('type')).not_to include('mention')
    end

    it 'aggregates repeat notifications into a single group' do
      # Two nudge notifications for the same subject collapse to one group.
      other = Fabricate(:account)
      subject_status = Fabricate(:status, account: account)
      2.times do
        Fabricate(:notification, account: account, type: :nudge, activity: subject_status, from_account: other)
      end

      get api_v1_nudges_activity_index_path, headers: headers

      nudge_groups = response.parsed_body.select { |g| g['type'] == 'nudge' }
      expect(nudge_groups.length).to eq(1)
      expect(nudge_groups.first['count']).to eq(2)
    end

    it 'requires authentication' do
      get api_v1_nudges_activity_index_path

      expect(response).to have_http_status(401).or have_http_status(403)
    end
  end
end
