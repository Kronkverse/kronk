# frozen_string_literal: true

require 'rails_helper'

# Who sees and removes a call's recordings (Tal, 2026-10-27;
# docs/spaces/huddle.md, Recordings).
RSpec.describe 'API V1 Calls Recordings' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:maker)   { Fabricate(:user).account }
  let(:kuddle)  { HuddleRoom::CreateService.new.call(account: maker, name: 'Ember') }

  before do
    allow(Kronk::CallRecordingStorage).to receive_messages(
      available?: true,
      play_url: 'https://bucket.example/play?signed',
      download_url: 'https://bucket.example/download?signed',
      delete: true
    )
  end

  def recording_of(kind, id = nil, status: 'ready')
    CallRecording.build_for(Kronk::CallTarget.find!(kind, id), filename: 'call.mp4', size: 100).tap do |recording|
      recording.status = status
      recording.save!
    end
  end

  def headers_for(account_user)
    t = Fabricate(:accessible_access_token, resource_owner_id: account_user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{t.token}" }
  end

  describe 'GET /api/v1/calls/recordings' do
    it 'lists a Kuddle’s ready recordings, newest first, for anyone who can see it', :aggregate_failures do
      older = recording_of('kuddle', kuddle.id)
      newer = recording_of('kuddle', kuddle.id)
      recording_of('kuddle', kuddle.id, status: 'pending')
      recording_of('huddle')

      get '/api/v1/calls/recordings', params: { kind: 'kuddle', id: kuddle.id }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck('id')).to eq([newer, older].map { |r| r.id.to_s })
      expect(response.parsed_body.first).to include(
        'url' => 'https://bucket.example/play?signed',
        'download_url' => 'https://bucket.example/download?signed',
        'can_delete' => false
      )
      expect(response.headers['Cache-Control']).to include('no-store')
    end

    it 'lists the Main Huddle’s for every member' do
      main = recording_of('huddle')

      get '/api/v1/calls/recordings', params: { kind: 'huddle' }, headers: headers

      expect(response.parsed_body.pluck('id')).to eq [main.id.to_s]
    end

    it 'says a retired Kuddle is not there' do
      recording_of('kuddle', kuddle.id)
      kuddle.retire!

      get '/api/v1/calls/recordings', params: { kind: 'kuddle', id: kuddle.id }, headers: headers

      expect(response).to have_http_status(404)
    end

    describe 'a live set’s' do
      let(:live) { Fabricate(:booth_live, account: maker, started_at: 1.hour.ago, ended_at: 1.minute.ago) }

      before { recording_of('booth_live', live.id) }

      it 'are the host’s alone', :aggregate_failures do
        get '/api/v1/calls/recordings', params: { kind: 'booth_live', id: live.id }, headers: headers
        expect(response).to have_http_status(200)
        expect(response.parsed_body).to eq []

        get '/api/v1/calls/recordings', params: { kind: 'booth_live', id: live.id }, headers: headers_for(maker.user)
        expect(response.parsed_body.size).to eq 1
        expect(response.parsed_body.first['can_delete']).to be true
      end

      it 'are not there for someone outside the set’s reach' do
        live.update!(visibility: :mates)

        get '/api/v1/calls/recordings', params: { kind: 'booth_live', id: live.id }, headers: headers

        expect(response).to have_http_status(404)
      end
    end

    it 'needs a signed-in member' do
      get '/api/v1/calls/recordings', params: { kind: 'huddle' }

      expect(response).to have_http_status(401)
    end
  end

  describe 'DELETE /api/v1/calls/recordings/:id' do
    let!(:recording) { recording_of('kuddle', kuddle.id) }

    it 'lets the Kuddle’s maker remove it, file and all', :aggregate_failures do
      delete "/api/v1/calls/recordings/#{recording.id}", headers: headers_for(maker.user)

      expect(response).to have_http_status(200)
      expect(CallRecording.exists?(recording.id)).to be false
      expect(Kronk::CallRecordingStorage).to have_received(:delete).with(recording.storage_key)
    end

    it 'lets staff remove it' do
      delete "/api/v1/calls/recordings/#{recording.id}", headers: headers_for(Fabricate(:moderator_user))

      expect(response).to have_http_status(200)
    end

    it 'does not let anyone else', :aggregate_failures do
      delete "/api/v1/calls/recordings/#{recording.id}", headers: headers

      expect(response).to have_http_status(403)
      expect(CallRecording.exists?(recording.id)).to be true
      expect(Kronk::CallRecordingStorage).to_not have_received(:delete)
    end

    it 'says a live set’s recording is not there for a listener' do
      live = Fabricate(:booth_live, account: maker, started_at: 1.hour.ago, ended_at: 1.minute.ago)
      theirs = recording_of('booth_live', live.id)

      delete "/api/v1/calls/recordings/#{theirs.id}", headers: headers

      expect(response).to have_http_status(404)
    end
  end
end
