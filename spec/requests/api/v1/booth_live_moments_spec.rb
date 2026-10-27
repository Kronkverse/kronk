# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md, The crowd on screen.
RSpec.describe 'API V1 Booth live moments' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:host_user) { Fabricate(:user) }
  let(:host_headers) do
    host_token = Fabricate(:accessible_access_token, resource_owner_id: host_user.id, scopes: 'read:statuses write:statuses')
    { 'Authorization' => "Bearer #{host_token.token}" }
  end
  let(:live) { Fabricate(:booth_live, account: host_user.account, started_at: 10.minutes.ago) }

  def moments_path(booth_live = live)
    "/api/v1/booth_lives/#{booth_live.id}/moments"
  end

  describe 'POST …/moments' do
    it 'takes a listener’s shoutout, timed from the start of the set', :aggregate_failures do
      post moments_path, headers: headers, params: { kind: 'shoutout', body: '  This tune!  ' }

      expect(response).to have_http_status(200)
      moment = live.moments.last
      expect(moment).to have_attributes(kind: 'shoutout', body: 'This tune!', account: user.account)
      expect(moment.at_seconds).to be_within(5).of(600)
      expect(response.parsed_body).to include('kind' => 'shoutout', 'text' => 'This tune!', 'can_remove' => true)
    end

    it 'takes a request and a reaction from the list, and nothing else as a reaction', :aggregate_failures do
      post moments_path, headers: headers, params: { kind: 'request', body: 'Something by Burial' }
      expect(response).to have_http_status(200)

      travel 3.seconds do
        post moments_path, headers: headers, params: { kind: 'reaction', body: 'applause' }
        expect(response).to have_http_status(200)
      end

      travel 6.seconds do
        post moments_path, headers: headers, params: { kind: 'reaction', body: 'anything' }
        expect(response).to have_http_status(422)
      end

      expect(live.moments.pluck(:kind, :body)).to eq [%w(request Something\ by\ Burial), %w(reaction applause)]
    end

    it 'slows down someone sending twice in a row' do
      post moments_path, headers: headers, params: { kind: 'reaction', body: 'froth' }
      post moments_path, headers: headers, params: { kind: 'reaction', body: 'froth' }

      expect(response).to have_http_status(429)
    end

    it 'refuses an empty shoutout and an unknown kind', :aggregate_failures do
      post moments_path, headers: headers, params: { kind: 'shoutout', body: ' ' }
      expect(response).to have_http_status(422)

      post moments_path, headers: headers, params: { kind: 'chat', body: 'hi' }
      expect(response).to have_http_status(422)
    end

    it 'is only while the set is live', :aggregate_failures do
      scheduled = Fabricate(:booth_live, account: host_user.account)
      ended = Fabricate(:booth_live, account: host_user.account, started_at: 2.hours.ago, ended_at: 1.hour.ago)

      post moments_path(scheduled), headers: headers, params: { kind: 'shoutout', body: 'Early' }
      expect(response).to have_http_status(422)

      post moments_path(ended), headers: headers, params: { kind: 'shoutout', body: 'Late' }
      expect(response).to have_http_status(422)
    end

    describe 'Now playing' do
      it 'is the host’s, and becomes the live set’s track list', :aggregate_failures do
        post moments_path, headers: host_headers, params: { kind: 'track', body: 'Burial - Archangel' }
        expect(response).to have_http_status(200)
        expect(response.parsed_body).to include('artist' => 'Burial', 'title' => 'Archangel', 'text' => 'Burial – Archangel')

        travel 5.minutes do
          post moments_path, headers: host_headers, params: { kind: 'track', body: 'Untitled' }
        end

        expect(live.reload.tracklist).to match [
          { 'start_seconds' => be_within(5).of(600), 'artist' => 'Burial', 'title' => 'Archangel' },
          { 'start_seconds' => be_within(5).of(900), 'artist' => nil, 'title' => 'Untitled' },
        ]
      end

      it 'is refused to a listener', :aggregate_failures do
        post moments_path, headers: headers, params: { kind: 'track', body: 'Burial - Archangel' }

        expect(response).to have_http_status(403)
        expect(live.moments.count).to eq 0
      end

      it 'shows on the set for anyone in it' do
        live.moments.create!(account: host_user.account, kind: 'track', title: 'Archangel', artist: 'Burial')

        get "/api/v1/booth_lives/#{live.id}", headers: headers

        expect(response.parsed_body['tracklist']).to eq [{ 'start_seconds' => live.moments.last.at_seconds, 'artist' => 'Burial', 'title' => 'Archangel' }]
      end
    end

    describe 'reach' do
      before { live.update!(visibility: :mates) }

      it 'is not there for someone the set doesn’t reach', :aggregate_failures do
        post moments_path, headers: headers, params: { kind: 'shoutout', body: 'Hello' }
        expect(response).to have_http_status(404)

        get moments_path, headers: headers
        expect(response).to have_http_status(404)
      end

      it 'is there for a Mate' do
        live.account.follow!(user.account)
        user.account.follow!(live.account)

        post moments_path, headers: headers, params: { kind: 'shoutout', body: 'Hello' }

        expect(response).to have_http_status(200)
      end
    end

    it 'is for members only' do
      post moments_path, params: { kind: 'shoutout', body: 'Hello' }

      expect(response).to have_http_status(401)
    end
  end

  describe 'GET …/moments' do
    let!(:first)  { live.moments.create!(account: user.account, kind: 'shoutout', body: 'One') }
    let!(:second) { live.moments.create!(account: host_user.account, kind: 'track', title: 'Two') }

    it 'lists them oldest first, and only the new ones after since_id', :aggregate_failures do
      get moments_path, headers: headers
      expect(response.parsed_body.pluck('id')).to eq [first.id.to_s, second.id.to_s]

      get moments_path, headers: headers, params: { since_id: first.id }
      expect(response.parsed_body.pluck('text')).to eq ['Two']

      get moments_path, headers: headers, params: { since_id: second.id }
      expect(response.parsed_body).to eq []
    end
  end

  describe 'DELETE /api/v1/booth_live_moments/:id' do
    let!(:moment) { live.moments.create!(account: user.account, kind: 'shoutout', body: 'Oops') }

    it 'lets the host take one down' do
      delete "/api/v1/booth_live_moments/#{moment.id}", headers: host_headers

      expect(BoothLiveMoment.exists?(moment.id)).to be false
    end

    it 'does not let another listener', :aggregate_failures do
      other = Fabricate(:user)
      other_token = Fabricate(:accessible_access_token, resource_owner_id: other.id, scopes: 'write:statuses')

      delete "/api/v1/booth_live_moments/#{moment.id}", headers: { 'Authorization' => "Bearer #{other_token.token}" }

      expect(response).to have_http_status(403)
      expect(BoothLiveMoment.exists?(moment.id)).to be true
    end
  end
end
