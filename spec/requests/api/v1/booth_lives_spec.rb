# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md, Live sets.
RSpec.describe 'API V1 Booth Lives' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/booth_lives' do
    let!(:live)       { Fabricate(:booth_live, title: 'On now', started_at: 10.minutes.ago) }
    let!(:soon)       { Fabricate(:booth_live, title: 'Soon', starts_at: 2.hours.from_now) }
    let!(:sooner)     { Fabricate(:booth_live, title: 'Sooner', starts_at: 30.minutes.from_now) }

    before do
      Fabricate(:booth_live, title: 'Over', started_at: 2.hours.ago, ended_at: 1.hour.ago)
      Fabricate(:booth_live, title: 'Forgotten', started_at: 13.hours.ago)
      Fabricate(:booth_live, title: 'Missed', starts_at: 7.hours.ago)
    end

    it 'lists what is live, then what is coming soonest first, and nothing over', :aggregate_failures do
      get '/api/v1/booth_lives', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck('id')).to eq([live, sooner, soon].map { |l| l.id.to_s })
      expect(response.parsed_body.pluck('state')).to eq %w(live scheduled scheduled)
      expect(response.parsed_body.first['room_key']).to start_with('booth-')
    end

    it 'is for members only' do
      get '/api/v1/booth_lives'

      expect(response).to have_http_status(401)
    end
  end

  describe 'GET /api/v1/booth_lives/now' do
    let!(:live) { Fabricate(:booth_live, started_at: 5.minutes.ago) }

    before { Fabricate(:booth_live, starts_at: 1.hour.from_now) }

    it 'lists only what is live, for the home feed banner' do
      get '/api/v1/booth_lives/now', headers: headers

      expect(response.parsed_body.pluck('id')).to eq [live.id.to_s]
    end

    it 'shows nothing to someone tuned out of the Booth' do
      KornerTuneOut.create!(account: user.account, korner_slug: 'booth', tuned_out_at: Time.current)

      get '/api/v1/booth_lives/now', headers: headers

      expect(response.parsed_body).to eq []
    end

    # decisions.md, 2026-10-26: a set reaches who its host picked.
    it 'leaves out a set for Mates to someone who is not one, there and everywhere', :aggregate_failures do
      live.update!(visibility: :mates)

      get '/api/v1/booth_lives/now', headers: headers
      expect(response.parsed_body).to eq []

      get '/api/v1/booth_lives', headers: headers
      expect(response.parsed_body.pluck('id')).to_not include(live.id.to_s)

      get "/api/v1/booth_lives/#{live.id}", headers: headers
      expect(response).to have_http_status(404)
    end

    it 'shows a set for Mates to a Mate' do
      live.update!(visibility: :mates)
      live.account.follow!(user.account)
      user.account.follow!(live.account)

      get '/api/v1/booth_lives/now', headers: headers

      expect(response.parsed_body.pluck('id')).to eq [live.id.to_s]
    end
  end

  describe 'going live' do
    it 'queues the nudge to everyone once, when the host starts' do
      booth_live = Fabricate(:booth_live, account: user.account)

      post "/api/v1/booth_lives/#{booth_live.id}/start", headers: headers
      post "/api/v1/booth_lives/#{booth_live.id}/start", headers: headers

      expect(Booth::LiveNotifyWorker).to have_enqueued_sidekiq_job(booth_live.id).once
    end
  end

  describe 'hosting' do
    it 'schedules, goes live and ends, owner only', :aggregate_failures do
      post '/api/v1/booth_lives', headers: headers, params: { title: 'Sunday session', genres: %w(house), starts_at: 1.day.from_now.iso8601 }
      id = response.parsed_body['id']

      expect(response.parsed_body).to include('state' => 'scheduled', 'is_owner' => true, 'genres' => %w(house))

      other = Fabricate(:user)
      other_token = Fabricate(:accessible_access_token, resource_owner_id: other.id, scopes: 'read:statuses write:statuses')
      post "/api/v1/booth_lives/#{id}/start", headers: { 'Authorization' => "Bearer #{other_token.token}" }
      expect(response).to have_http_status(403)

      post "/api/v1/booth_lives/#{id}/start", headers: headers
      expect(response.parsed_body['state']).to eq 'live'

      delete "/api/v1/booth_lives/#{id}", headers: headers
      expect(response).to have_http_status(403)

      post "/api/v1/booth_lives/#{id}/finish", headers: headers
      expect(response.parsed_body['state']).to eq 'ended'

      post "/api/v1/booth_lives/#{id}/start", headers: headers
      expect(response).to have_http_status(403)
    end

    it 'keeps a set that was recorded, since its recordings are kept', :aggregate_failures do
      booth_live = Fabricate(:booth_live, account: user.account, started_at: 1.hour.ago, ended_at: 1.minute.ago)
      CallRecording.build_for(Kronk::CallTarget.new('booth_live', booth_live), filename: 'set.mp4', size: 100).save!

      delete "/api/v1/booth_lives/#{booth_live.id}", headers: headers

      expect(response).to have_http_status(403)
      expect(BoothLive.exists?(booth_live.id)).to be true
    end

    it 'nudges whoever asked to be reminded, even if they tuned out of the Booth', :aggregate_failures do
      host = Fabricate(:user).account
      booth_live = Fabricate(:booth_live, account: host)
      KornerTuneOut.create!(account: user.account, korner_slug: 'booth', tuned_out_at: Time.current)

      post "/api/v1/booth_lives/#{booth_live.id}/remind", headers: headers
      expect(response.parsed_body['reminded']).to be true

      booth_live.update!(started_at: Time.current)
      Booth::LiveNotifier.new(booth_live).call

      expect(Nudges::Event.addressed_to(user.account).where(source_korner_slug: 'booth', verb: 'went_live').count).to eq 1
    end

    it 'does not remind you of your own set' do
      booth_live = Fabricate(:booth_live, account: user.account)

      post "/api/v1/booth_lives/#{booth_live.id}/remind", headers: headers

      expect(response).to have_http_status(403)
    end

    it 'starts now when no time is given' do
      post '/api/v1/booth_lives', headers: headers, params: { title: 'Right now' }

      expect(Time.zone.parse(response.parsed_body['starts_at'])).to be_within(1.minute).of(Time.current)
    end

    it 'tells the feed at the reach the host picks, never a retired one', :aggregate_failures do
      booth_live = Fabricate(:booth_live, account: user.account, started_at: 1.minute.ago)

      post "/api/v1/booth_lives/#{booth_live.id}/share", headers: headers, params: { visibility: 'mates' }
      status = Status.find(response.parsed_body['id'])
      expect(status.visibility).to eq 'mates'
      # decisions.md, 2026-10-26: a post is what the host wrote, or the title;
      # the set's card says it's live and opens the room.
      expect(status.text).to eq booth_live.title
      expect(status.source_korner).to eq 'booth'
      expect(booth_live.reload.status_id).to eq status.id

      post "/api/v1/booth_lives/#{booth_live.id}/share", headers: headers, params: { visibility: 'unlisted' }
      expect(Status.find(response.parsed_body['id']).visibility).to eq 'public'
    end

    it "posts the host's own words when they write some, with the set as its card", :aggregate_failures do
      booth_live = Fabricate(:booth_live, account: user.account, started_at: 1.minute.ago)

      post "/api/v1/booth_lives/#{booth_live.id}/share", headers: headers, params: { comment: 'Come dance' }

      expect(response.parsed_body['content']).to include('Come dance')
      expect(response.parsed_body['content']).to_not include('/hub/booth/live/')
      expect(response.parsed_body.dig('booth_live', 'id')).to eq booth_live.id.to_s
      expect(response.parsed_body['booth_live']).to_not have_key('room_key')
    end
  end
end
