# frozen_string_literal: true

require 'rails_helper'

# docs/decisions.md, 2026-10-27, "Kronk's own Jitsi": a pass into a call.
RSpec.describe 'API V1 Calls Token' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:maker)   { Fabricate(:account) }
  let(:kuddle)  { HuddleRoom::CreateService.new.call(account: maker, name: 'Ember') }

  def pass_for(kind, id = nil, as: headers)
    post '/api/v1/calls/token', params: { kind: kind, id: id }.compact, headers: as
  end

  def claims
    JWT.decode(response.parsed_body['jwt'], 's3cret', true, algorithm: 'HS256', aud: 'jitsi', verify_aud: true).first
  end

  context 'without JITSI_JWT_SECRET' do
    before { allow(Kronk::Jitsi).to receive(:jwt_secret).and_return(nil) }

    it 'gives the room and no token, the old open server', :aggregate_failures do
      pass_for('huddle')

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include(
        'domain' => Rails.configuration.x.kronk_jitsi_domain, 'room' => 'huddle', 'jwt' => nil,
        'moderator' => false, 'recording' => false
      )
    end
  end

  context 'with JITSI_JWT_SECRET' do
    before { allow(Kronk::Jitsi).to receive(:jwt_secret).and_return('s3cret') }

    it 'lets any member into the Main Huddle, not as moderator', :aggregate_failures do
      pass_for('huddle')

      expect(response).to have_http_status(200)
      expect(claims).to include('iss' => 'kronk', 'sub' => 'meet.jitsi', 'room' => 'huddle')
      expect(claims.dig('context', 'user', 'id')).to eq user.account_id.to_s
      expect(claims.dig('context', 'user', 'moderator')).to be false
      expect(claims['exp'] - claims['iat']).to eq 2.hours.to_i
      expect(claims['nbf']).to be <= claims['iat']
    end

    it 'makes staff the Main Huddle’s moderators' do
      staff = Fabricate(:moderator_user)
      staff_token = Fabricate(:accessible_access_token, resource_owner_id: staff.id, scopes: 'read')

      pass_for('huddle', as: { 'Authorization' => "Bearer #{staff_token.token}" })

      expect(claims.dig('context', 'user', 'moderator')).to be true
    end

    it 'opens a Kuddle by its room key, for anyone signed in', :aggregate_failures do
      pass_for('kuddle', kuddle.id)

      expect(response).to have_http_status(200)
      expect(response.parsed_body['room']).to eq kuddle.session_url
      expect(claims['room']).to eq kuddle.session_url
      expect(response.parsed_body['moderator']).to be false
    end

    it 'makes the Kuddle’s maker its moderator', :aggregate_failures do
      own = HuddleRoom::CreateService.new.call(account: user.account, name: 'Mine')

      pass_for('kuddle', own.id)

      expect(response.parsed_body['moderator']).to be true
      expect(claims.dig('context', 'user', 'affiliation')).to eq 'owner'
    end

    it 'says a retired Kuddle is not there' do
      kuddle.retire!

      pass_for('kuddle', kuddle.id)

      expect(response).to have_http_status(404)
    end

    it 'puts JITSI_ROOM_PREFIX before every room', :aggregate_failures do
      allow(Kronk::Jitsi).to receive(:room_prefix).and_return('shadow-')

      pass_for('huddle')
      expect(response.parsed_body['room']).to eq 'shadow-huddle'
      expect(claims['room']).to eq 'shadow-huddle'

      pass_for('kuddle', kuddle.id)
      expect(response.parsed_body['room']).to eq "shadow-#{kuddle.session_url}"
    end

    describe 'a Booth live set' do
      let(:live) { Fabricate(:booth_live, account: maker, started_at: 5.minutes.ago) }

      it 'lets in whoever its reach allows while it is live', :aggregate_failures do
        pass_for('booth_live', live.id)

        expect(response).to have_http_status(200)
        expect(response.parsed_body['room']).to eq live.room_key
        expect(response.parsed_body['moderator']).to be false
      end

      it 'is not there for someone outside its reach' do
        live.update!(visibility: :mates)

        pass_for('booth_live', live.id)

        expect(response).to have_http_status(404)
      end

      it 'refuses a listener before it starts, and lets the host in to get ready', :aggregate_failures do
        planned = Fabricate(:booth_live, account: user.account)
        theirs  = Fabricate(:booth_live, account: maker)

        pass_for('booth_live', theirs.id)
        expect(response).to have_http_status(403)

        pass_for('booth_live', planned.id)
        expect(response).to have_http_status(200)
        expect(response.parsed_body['moderator']).to be true
      end

      it 'refuses everyone once it has ended' do
        live.finish!

        pass_for('booth_live', live.id)

        expect(response).to have_http_status(403)
      end
    end

    it 'says recording is on when the recorder and storage are set up too' do
      allow(Kronk::Jitsi).to receive(:recording_secret).and_return('rec')
      allow(Kronk::CallRecordingStorage).to receive(:available?).and_return(true)

      pass_for('huddle')

      expect(response.parsed_body['recording']).to be true
    end

    it 'refuses an unknown kind' do
      pass_for('krew', 1)

      expect(response).to have_http_status(404)
    end
  end

  it 'needs a signed-in member' do
    post '/api/v1/calls/token', params: { kind: 'huddle' }

    expect(response).to have_http_status(401)
  end
end
