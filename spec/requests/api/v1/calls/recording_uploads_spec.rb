# frozen_string_literal: true

require 'rails_helper'

# The recorder handing Kronk a recording (docs/spaces/huddle.md, Recordings).
RSpec.describe 'API V1 Calls Recording uploads' do
  let(:secret) { 'recorder-secret' }
  let(:maker)  { Fabricate(:account) }
  let(:kuddle) { HuddleRoom::CreateService.new.call(account: maker, name: 'Ember') }

  before do
    allow(Kronk::Jitsi).to receive(:recording_secret).and_return(secret)
    allow(Kronk::CallRecordingStorage).to receive_messages(
      available?: true,
      upload_url: 'https://bucket.example/call_recordings/put?signed',
      delete: true
    )
  end

  def signed_post(path, body, at: Time.current.to_i, key: secret)
    raw = body.is_a?(String) ? body : body.to_json
    signature = OpenSSL::HMAC.hexdigest('SHA256', key, "#{at}.#{raw}")
    post path, params: raw, headers: {
      'Content-Type' => 'application/json',
      'X-Kronk-Timestamp' => at.to_s,
      'X-Kronk-Signature' => "sha256=#{signature}",
    }
  end

  describe 'POST /api/v1/calls/recordings/start' do
    it 'makes a pending recording for a Kuddle and hands back a signed upload URL', :aggregate_failures do
      signed_post '/api/v1/calls/recordings/start', { room: kuddle.session_url, filename: 'ember_2026-10-27.mp4', size: 1_000_000 }

      expect(response).to have_http_status(201)
      recording = CallRecording.find(response.parsed_body['id'])
      expect(recording).to have_attributes(kind: 'kuddle', huddle_session: kuddle, status: 'pending', size: 1_000_000, content_type: 'video/mp4')
      expect(recording.storage_key).to match(%r{\Acall_recordings/\h{32}/ember_2026-10-27\.mp4\z})
      expect(response.parsed_body).to include(
        'upload_url' => 'https://bucket.example/call_recordings/put?signed',
        'upload_method' => 'PUT',
        'upload_headers' => { 'Content-Type' => 'video/mp4' }
      )
      expect(Kronk::CallRecordingStorage).to have_received(:upload_url).with(recording.storage_key, 'video/mp4')
    end

    it 'knows the Main Huddle and a live set by their room names, prefix and all', :aggregate_failures do
      allow(Kronk::Jitsi).to receive(:room_prefix).and_return('shadow-')
      live = Fabricate(:booth_live, account: maker, started_at: 1.hour.ago, ended_at: 1.minute.ago)

      signed_post '/api/v1/calls/recordings/start', { room: 'shadow-huddle', filename: 'h.mp4', size: 10 }
      expect(CallRecording.last).to have_attributes(kind: 'huddle', huddle_session_id: nil, booth_live_id: nil)

      signed_post '/api/v1/calls/recordings/start', { room: "shadow-#{live.room_key}", filename: 'set.webm', size: 10 }
      expect(CallRecording.last).to have_attributes(kind: 'booth_live', booth_live: live, content_type: 'video/webm')

      # Production's names, on a shared server, aren't shadow's.
      signed_post '/api/v1/calls/recordings/start', { room: 'huddle', filename: 'h.mp4', size: 10 }
      expect(response).to have_http_status(404)
    end

    it 'keeps who started it when the recorder knows' do
      signed_post '/api/v1/calls/recordings/start', { room: 'huddle', filename: 'h.mp4', size: 10, started_by: maker.id.to_s }

      expect(CallRecording.last.started_by_account).to eq maker
    end

    it 'refuses a room that is not one of Kronk’s calls' do
      signed_post '/api/v1/calls/recordings/start', { room: 'someone-elses-room', filename: 'x.mp4', size: 10 }

      expect(response).to have_http_status(404)
    end

    it 'refuses a file over 4 GB', :aggregate_failures do
      signed_post '/api/v1/calls/recordings/start', { room: 'huddle', filename: 'big.mp4', size: 4.gigabytes + 1 }

      expect(response).to have_http_status(413)
      expect(CallRecording.count).to eq 0
    end

    it 'refuses a filename that is not a plain video file', :aggregate_failures do
      signed_post '/api/v1/calls/recordings/start', { room: 'huddle', filename: '../../etc/passwd', size: 10 }
      expect(response).to have_http_status(422)

      signed_post '/api/v1/calls/recordings/start', { room: 'huddle', filename: 'notes.txt', size: 10 }
      expect(response).to have_http_status(422)
    end

    describe 'the signature' do
      let(:body) { { room: 'huddle', filename: 'h.mp4', size: 10 } }

      it 'refuses one made with another secret' do
        signed_post '/api/v1/calls/recordings/start', body, key: 'wrong'

        expect(response).to have_http_status(401)
      end

      it 'refuses a body changed after signing' do
        at = Time.current.to_i
        signature = OpenSSL::HMAC.hexdigest('SHA256', secret, "#{at}.#{body.to_json}")
        post '/api/v1/calls/recordings/start', params: body.merge(size: 20).to_json, headers: {
          'Content-Type' => 'application/json', 'X-Kronk-Timestamp' => at.to_s, 'X-Kronk-Signature' => "sha256=#{signature}",
        }

        expect(response).to have_http_status(401)
      end

      it 'refuses a stale timestamp, either way', :aggregate_failures do
        signed_post '/api/v1/calls/recordings/start', body, at: 6.minutes.ago.to_i
        expect(response).to have_http_status(401)

        signed_post '/api/v1/calls/recordings/start', body, at: 6.minutes.from_now.to_i
        expect(response).to have_http_status(401)
      end

      it 'refuses a request with none' do
        post '/api/v1/calls/recordings/start', params: body.to_json, headers: { 'Content-Type' => 'application/json' }

        expect(response).to have_http_status(401)
      end
    end

    it 'is not there without JITSI_RECORDING_SECRET' do
      allow(Kronk::Jitsi).to receive(:recording_secret).and_return(nil)

      signed_post '/api/v1/calls/recordings/start', { room: 'huddle', filename: 'h.mp4', size: 10 }

      expect(response).to have_http_status(404)
    end
  end

  describe 'POST /api/v1/calls/recordings/:id/complete' do
    let(:recording) do
      CallRecording.build_for(Kronk::CallTarget.find!('kuddle', kuddle.id), filename: 'ember.mp4', size: 100).tap(&:save!)
    end

    it 'marks it ready once the file is there', :aggregate_failures do
      allow(Kronk::CallRecordingStorage).to receive(:stored_size).with(recording.storage_key).and_return(123)

      signed_post "/api/v1/calls/recordings/#{recording.id}/complete", { duration: 600 }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to eq('id' => recording.id.to_s, 'status' => 'ready', 'size' => 123)
      expect(recording.reload).to have_attributes(status: 'ready', size: 123, duration: 600)
    end

    it 'takes an empty body' do
      allow(Kronk::CallRecordingStorage).to receive(:stored_size).and_return(5)

      signed_post "/api/v1/calls/recordings/#{recording.id}/complete", ''

      expect(response).to have_http_status(200)
    end

    it 'waits while nothing has been uploaded', :aggregate_failures do
      allow(Kronk::CallRecordingStorage).to receive(:stored_size).and_return(nil)

      signed_post "/api/v1/calls/recordings/#{recording.id}/complete", {}

      expect(response).to have_http_status(422)
      expect(recording.reload.status).to eq 'pending'
    end

    it 'throws away an upload over 4 GB', :aggregate_failures do
      allow(Kronk::CallRecordingStorage).to receive(:stored_size).and_return(5.gigabytes)

      signed_post "/api/v1/calls/recordings/#{recording.id}/complete", {}

      expect(response).to have_http_status(413)
      expect(CallRecording.exists?(recording.id)).to be false
      expect(Kronk::CallRecordingStorage).to have_received(:delete).with(recording.storage_key)
    end

    it 'needs the signature too' do
      signed_post "/api/v1/calls/recordings/#{recording.id}/complete", {}, key: 'wrong'

      expect(response).to have_http_status(401)
    end
  end
end
