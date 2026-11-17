# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md, Samples.
RSpec.describe 'API V1 Booth Samples' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:maker)   { Fabricate(:account) }
  let(:events)  { [] }

  before do
    allow(Kronk::KornerEvents).to receive(:publish) { |name, **payload| events << [name, payload] }
  end

  def upload_audio(account = user.account)
    Fabricate(:media_attachment, account: account, type: :audio, file: attachment_fixture('boop.mp3'))
  end

  describe 'POST /api/v1/booth_samples' do
    it 'shares a sample with its details', :aggregate_failures do
      audio = upload_audio

      post '/api/v1/booth_samples', headers: headers, params: {
        audio_id: audio.id, title: ' Dusty  break ', sample_type: 'loop', musical_key: 'A minor',
        bpm: 92, genre: 'Hip hop', vibes: %w(beats), terms: 'ask', duration_seconds: 8
      }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include(
        'title' => 'Dusty break', 'sample_type' => 'loop', 'musical_key' => 'A minor', 'bpm' => 92,
        'genre' => 'Hip hop', 'vibes' => %w(beats), 'terms' => 'ask', 'is_owner' => true, 'can_download' => true
      )
      expect(response.parsed_body['duration_seconds']).to be_between(1, 120)
    end

    it 'goes by the length read from the file, not the one sent', :attachment_processing do
      audio = Fabricate(:media_attachment, account: user.account, file: attachment_fixture('boop.mp3'))

      post '/api/v1/booth_samples', headers: headers, params: { audio_id: audio.id, title: 'Boop', sample_type: 'one_shot', duration_seconds: 500 }

      expect(response.parsed_body['duration_seconds']).to eq 1
    end

    it 'refuses a file longer than two minutes', :aggregate_failures do
      allow(BoothSetTrack).to receive(:media_duration).and_return(121)

      post '/api/v1/booth_samples', headers: headers, params: { audio_id: upload_audio.id, title: 'Whole song', sample_type: 'stem' }

      expect(response).to have_http_status(422)
      expect(response.parsed_body['error']).to include('two minutes or less')
    end

    it 'refuses an unknown type, a third vibe, or someone else’s file', :aggregate_failures do
      post '/api/v1/booth_samples', headers: headers, params: { audio_id: upload_audio.id, title: 'X', sample_type: 'song' }
      expect(response).to have_http_status(422)

      post '/api/v1/booth_samples', headers: headers, params: { audio_id: upload_audio.id, title: 'X', sample_type: 'loop', vibes: %w(beats acoustic organic) }
      expect(response).to have_http_status(422)

      post '/api/v1/booth_samples', headers: headers, params: { audio_id: upload_audio(maker).id, title: 'X', sample_type: 'loop' }
      expect(response).to have_http_status(404)
    end

    it 'puts a sample in one of your packs, never someone else’s', :aggregate_failures do
      mine = Fabricate(:booth_sample_pack, account: user.account)
      theirs = Fabricate(:booth_sample_pack, account: maker)

      post '/api/v1/booth_samples', headers: headers, params: { audio_id: upload_audio.id, title: 'Kick', sample_type: 'one_shot', pack_id: mine.id, duration_seconds: 1 }
      expect(response.parsed_body['pack']).to eq('id' => mine.id.to_s, 'title' => mine.title)

      post '/api/v1/booth_samples', headers: headers, params: { audio_id: upload_audio.id, title: 'Snare', sample_type: 'one_shot', pack_id: theirs.id, duration_seconds: 1 }
      expect(response).to have_http_status(404)
    end
  end

  describe 'GET /api/v1/booth_samples' do
    it 'lists samples newest first, filters by type, and says which you may download', :aggregate_failures do
      free = Fabricate(:booth_sample, account: maker, title: 'Free loop')
      ask = Fabricate(:booth_sample, account: maker, title: 'Ask vocal', sample_type: 'vocal', terms: 'ask')

      get '/api/v1/booth_samples', headers: headers
      expect(response.parsed_body.pluck('title')).to eq ['Ask vocal', 'Free loop']
      expect(response.parsed_body.to_h { |s| [s['title'], s['can_download']] }).to eq('Ask vocal' => false, 'Free loop' => true)

      get '/api/v1/booth_samples', headers: headers, params: { type: 'vocal' }
      expect(response.parsed_body.pluck('id')).to eq [ask.id.to_s]

      ask.requests.create!(account: user.account, state: 'yes')
      get '/api/v1/booth_samples', headers: headers, params: { usable: true }
      expect(response.parsed_body.pluck('id')).to contain_exactly(free.id.to_s, ask.id.to_s)
    end

    it 'leaves out an ask-first sample you were not given from what you can use' do
      Fabricate(:booth_sample, account: maker, terms: 'ask')

      get '/api/v1/booth_samples', headers: headers, params: { usable: true }

      expect(response.parsed_body).to be_empty
    end

    it 'hides the samples of someone who blocked you' do
      Fabricate(:booth_sample, account: maker)
      maker.block!(user.account)

      get '/api/v1/booth_samples', headers: headers

      expect(response.parsed_body).to be_empty
    end
  end

  describe 'asking first' do
    let(:sample) { Fabricate(:booth_sample, account: maker, terms: 'ask') }
    let(:maker_user) { Fabricate(:user, account: maker) }
    let(:maker_token) { Fabricate(:accessible_access_token, resource_owner_id: maker_user.id, scopes: 'read:statuses write:statuses') }
    let(:maker_headers) { { 'Authorization' => "Bearer #{maker_token.token}" } }

    it 'asks, the maker says yes, and the asker may then download it', :aggregate_failures do
      post "/api/v1/booth_samples/#{sample.id}/requests", headers: headers
      expect(response.parsed_body).to include('request_state' => 'pending', 'can_download' => false)
      expect(events).to eq [['booth.sample.asked', { actor_account_id: user.account.id, recipient_account_id: maker.id, booth_sample_id: sample.id }]]

      get "/api/v1/booth_samples/#{sample.id}", headers: maker_headers
      expect(response.parsed_body['pending_requests']).to eq 1

      get "/api/v1/booth_samples/#{sample.id}/requests", headers: maker_headers
      request_id = response.parsed_body.first['id']
      expect(response.parsed_body.first.dig('account', 'id')).to eq user.account.id.to_s

      patch "/api/v1/booth_sample_requests/#{request_id}", headers: maker_headers, params: { state: 'yes' }
      expect(response.parsed_body['state']).to eq 'yes'
      expect(events.last).to eq ['booth.sample.granted', { actor_account_id: maker.id, recipient_account_id: user.account.id, booth_sample_id: sample.id }]

      get "/api/v1/booth_samples/#{sample.id}", headers: headers
      expect(response.parsed_body).to include('request_state' => 'yes', 'can_download' => true)
    end

    it 'lets only the maker see and answer requests', :aggregate_failures do
      request = sample.requests.create!(account: Fabricate(:account))

      get "/api/v1/booth_samples/#{sample.id}/requests", headers: headers
      expect(response).to have_http_status(403)

      patch "/api/v1/booth_sample_requests/#{request.id}", headers: headers, params: { state: 'yes' }
      expect(response).to have_http_status(403)
      expect(request.reload.state).to eq 'pending'
    end

    it 'tells the asker about a no, and lets them ask again', :aggregate_failures do
      request = sample.requests.create!(account: user.account)

      patch "/api/v1/booth_sample_requests/#{request.id}", headers: maker_headers, params: { state: 'no' }
      expect(events.last.first).to eq 'booth.sample.declined'

      post "/api/v1/booth_samples/#{sample.id}/requests", headers: headers
      expect(request.reload.state).to eq 'pending'
      expect(events.last.first).to eq 'booth.sample.asked'
    end

    it 'has nothing to ask on a free sample or your own', :aggregate_failures do
      post "/api/v1/booth_samples/#{Fabricate(:booth_sample, account: maker).id}/requests", headers: headers
      expect(response).to have_http_status(403)

      post "/api/v1/booth_samples/#{Fabricate(:booth_sample, account: user.account, terms: 'ask').id}/requests", headers: headers
      expect(response).to have_http_status(403)
    end
  end

  describe 'editing and deleting' do
    it 'lets the maker edit and delete, nobody else', :aggregate_failures do
      sample = Fabricate(:booth_sample, account: maker)

      patch "/api/v1/booth_samples/#{sample.id}", headers: headers, params: { title: 'Mine now' }
      expect(response).to have_http_status(403)
      delete "/api/v1/booth_samples/#{sample.id}", headers: headers
      expect(response).to have_http_status(403)

      own = Fabricate(:booth_sample, account: user.account)
      patch "/api/v1/booth_samples/#{own.id}", headers: headers, params: { terms: 'ask', bpm: '' }
      expect(response.parsed_body).to include('terms' => 'ask', 'bpm' => nil)
      delete "/api/v1/booth_samples/#{own.id}", headers: headers
      expect(BoothSample.exists?(own.id)).to be false
    end
  end

  describe 'packs' do
    it 'makes a pack, lists it once it has samples, and shows them', :aggregate_failures do
      post '/api/v1/booth_sample_packs', headers: headers, params: { title: 'Dusty drums' }
      pack_id = response.parsed_body['id']

      get '/api/v1/booth_sample_packs', headers: headers
      expect(response.parsed_body).to be_empty

      pack = BoothSamplePack.find(pack_id)
      Fabricate(:booth_sample, account: user.account, pack: pack, title: 'Kick', sample_type: 'one_shot', position: 0)
      Fabricate(:booth_sample, account: user.account, pack: pack, title: 'Groove', position: 1)

      get '/api/v1/booth_sample_packs', headers: headers
      expect(response.parsed_body.first).to include('title' => 'Dusty drums', 'sample_count' => 2, 'sample_types' => %w(one_shot loop))

      get "/api/v1/booth_sample_packs/#{pack_id}", headers: headers
      expect(response.parsed_body['samples'].pluck('title')).to eq %w(Kick Groove)

      delete "/api/v1/booth_sample_packs/#{pack_id}", headers: headers
      expect(BoothSample.where(booth_sample_pack_id: pack_id)).to be_empty
    end
  end

  describe 'Samples used on a set' do
    let(:set) { Fabricate(:booth_set, account: user.account, published: true) }

    it 'credits samples you may use, tells their makers, and shows the set under Used in', :aggregate_failures do
      free = Fabricate(:booth_sample, account: maker, title: 'Free loop')
      given = Fabricate(:booth_sample, account: maker, terms: 'ask', title: 'Given vocal')
      given.requests.create!(account: user.account, state: 'yes')
      withheld = Fabricate(:booth_sample, account: maker, terms: 'ask', title: 'Withheld')
      own = Fabricate(:booth_sample, account: user.account, title: 'Own')

      patch "/api/v1/booth_sets/#{set.id}", headers: headers, params: { sample_ids: [given.id, free.id, withheld.id, own.id] }

      expect(response.parsed_body['samples_used'].pluck('title')).to eq ['Given vocal', 'Free loop', 'Own']
      expect(response.parsed_body['samples_used'].first.dig('account', 'acct')).to eq maker.acct
      expect(events).to eq([given, free].map { |s| ['booth.sample.used', { actor_account_id: user.account.id, recipient_account_id: maker.id, booth_set_id: set.id, booth_sample_id: s.id }] })

      get "/api/v1/booth_samples/#{free.id}", headers: headers
      expect(response.parsed_body['used_in'].pluck('title')).to eq [set.title]

      events.clear
      patch "/api/v1/booth_sets/#{set.id}", headers: headers, params: { sample_ids: [free.id] }
      expect(response.parsed_body['samples_used'].pluck('title')).to eq ['Free loop']
      expect(events).to be_empty
    end
  end
end
