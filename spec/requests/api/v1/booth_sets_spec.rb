# frozen_string_literal: true

require 'rails_helper'

# The Booth grid is this one endpoint — `features/booth/index.tsx` fetches
# `/api/v1/booth_sets` once and renders whatever comes back. So a 500 here
# is not a degraded list, it is an empty Booth for every member, which is
# exactly what happened between 2026-08-15 and 2026-09-04: the index
# preloaded `:event` after `belongs_to :event` had been retired from the
# model, so every request raised `ActiveRecord::AssociationNotFoundError`.
# There was no request spec on this endpoint at the time.
RSpec.describe 'API V1 Booth Sets' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/booth_sets' do
    let!(:published_set) { Fabricate(:booth_set, published: true, title: 'Published set') }
    let!(:draft_set)     { Fabricate(:booth_set, published: false, title: 'Draft set') }

    it 'returns the published sets', :aggregate_failures do
      get '/api/v1/booth_sets', headers: headers

      expect(response).to have_http_status(200)
      expect(response.content_type).to start_with('application/json')
      expect(response.parsed_body.pluck('id')).to contain_exactly(published_set.id.to_s)
    end

    it 'does not include unpublished sets' do
      get '/api/v1/booth_sets', headers: headers

      expect(response.parsed_body.pluck('id')).to_not include(draft_set.id.to_s)
    end

    # A set whose media was destroyed out from under it keeps its row —
    # `booth_sets.audio_attachment_id` is `ON DELETE SET NULL`, so the
    # pointer is blanked rather than the row removed. One such row exists
    # on shadow. It must not take the whole listing down with it.
    context 'when a set has lost its media' do
      let!(:orphaned_set) do
        Fabricate(:booth_set, published: true, title: 'Lost media', audio_attachment_id: nil, cover_attachment_id: nil)
      end

      it 'still serialises the listing', :aggregate_failures do
        get '/api/v1/booth_sets', headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body.pluck('id')).to include(orphaned_set.id.to_s)

        row = response.parsed_body.find { |r| r['id'] == orphaned_set.id.to_s }
        expect(row['audio_url']).to be_nil
        expect(row['cover_url']).to be_nil
      end
    end

    context 'when looking for something' do
      let!(:techno) { Fabricate(:booth_set, published: true, title: 'Warehouse', artist_name: 'Lena K', genres: %w(techno)) }
      let!(:ambient) { Fabricate(:booth_set, published: true, title: 'Slow Sunday', artist_name: 'Ash', genres: %w(ambient dub)) }

      def ids_for(params)
        get '/api/v1/booth_sets', headers: headers, params: params
        response.parsed_body.pluck('id')
      end

      it 'searches title, credit line and genres, ignoring case', :aggregate_failures do
        expect(ids_for(q: 'warehouse')).to eq [techno.id.to_s]
        expect(ids_for(q: 'lena')).to eq [techno.id.to_s]
        expect(ids_for(q: 'DUB')).to eq [ambient.id.to_s]
        expect(ids_for(q: '100%')).to eq []
      end

      it 'filters by an exact genre' do
        expect(ids_for(genre: 'ambient')).to eq [ambient.id.to_s]
      end

      it 'pages back from max_id, newest first', :aggregate_failures do
        expect(ids_for({}).first(3)).to eq [ambient.id.to_s, techno.id.to_s, published_set.id.to_s]
        expect(ids_for(max_id: ambient.id)).to eq [techno.id.to_s, published_set.id.to_s]
      end
    end
  end

  describe 'listening tools' do
    let(:write_token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
    let(:write_headers) { { 'Authorization' => "Bearer #{write_token.token}" } }
    let!(:short_mix)    { Fabricate(:booth_set, published: true, kind: 'mix', play_count: 50, duration_seconds: 600) }
    let!(:long_podcast) { Fabricate(:booth_set, published: true, kind: 'podcast', play_count: 5, duration_seconds: 7200) }
    let!(:my_draft)     { Fabricate(:booth_set, account: user.account, published: false, kind: 'track') }

    def ids_for(params)
      get '/api/v1/booth_sets', headers: write_headers, params: params
      response.parsed_body.pluck('id')
    end

    it 'filters by kind and sorts the way the listener asks', :aggregate_failures do
      expect(ids_for(kind: 'podcast')).to eq [long_podcast.id.to_s]
      expect(ids_for(sort: 'fewest')).to eq([long_podcast, short_mix].map { |s| s.id.to_s })
      expect(ids_for(sort: 'longest')).to eq([long_podcast, short_mix].map { |s| s.id.to_s })
      expect(ids_for(sort: 'fewest', offset: 1)).to eq [short_mix.id.to_s]
    end

    it 'rejects a kind it does not know' do
      patch "/api/v1/booth_sets/#{my_draft.id}", headers: write_headers, params: { kind: 'symphony' }

      expect(response).to have_http_status(422)
    end

    it 'lists your own sets, drafts included, under mine' do
      expect(ids_for(mine: true)).to eq [my_draft.id.to_s]
    end

    it 'saves and unsaves a set, privately', :aggregate_failures do
      post "/api/v1/booth_sets/#{long_podcast.id}/save", headers: write_headers
      expect(response.parsed_body['saved']).to be true

      expect(ids_for(saved: true)).to eq [long_podcast.id.to_s]
      get '/api/v1/booth_sets', headers: write_headers
      expect(response.parsed_body.to_h { |s| [s['id'], s['saved']] }).to include(long_podcast.id.to_s => true, short_mix.id.to_s => false)

      delete "/api/v1/booth_sets/#{long_podcast.id}/save", headers: write_headers
      expect(ids_for(saved: true)).to eq []
    end
  end

  describe 'first listens' do
    let(:read_headers) { headers }
    let!(:fresh)       { Fabricate(:booth_set, published: true, play_count: 2) }
    let!(:mine)        { Fabricate(:booth_set, account: user.account, published: true, play_count: 0) }

    before do
      Fabricate(:booth_set, published: true, play_count: 40)
      Fabricate(:booth_set, published: true, play_count: 1, created_at: 2.months.ago)
    end

    it 'lists recent sets that have barely been heard, not your own' do
      get '/api/v1/booth_sets', headers: read_headers, params: { first_listens: true }

      expect(response.parsed_body.pluck('id')).to eq [fresh.id.to_s]
    end

    it 'shows play counts to the artist only', :aggregate_failures do
      get '/api/v1/booth_sets', headers: read_headers

      rows = response.parsed_body.index_by { |row| row['id'] }
      expect(rows[fresh.id.to_s]).to_not have_key('play_count')
      expect(rows[mine.id.to_s]['play_count']).to eq 0
    end
  end

  describe 'POST /api/v1/booth_sets/:id/share' do
    let(:write_token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
    let(:write_headers) { { 'Authorization' => "Bearer #{write_token.token}" } }
    let(:booth_set)     { Fabricate(:booth_set, account: user.account, published: true) }

    def share(params = {})
      post "/api/v1/booth_sets/#{booth_set.id}/share", headers: write_headers, params: params
      Status.find(response.parsed_body['id'])
    end

    it 'posts at the reach the member picked and links the set to it', :aggregate_failures do
      status = share(visibility: 'mates')

      expect(status.visibility).to eq 'mates'
      expect(status.source_korner).to eq 'booth'
      expect(booth_set.reload.status_id).to eq status.id
    end

    # decisions.md, 2026-10-26: the card carries the set; the post is the
    # musician's words, or its title, with no link of its own.
    it 'posts the title, or what the member wrote, and no link', :aggregate_failures do
      expect(share.text).to eq booth_set.title
      expect(share(comment: 'New mix').text).to eq 'New mix'
    end

    it 'never posts at a retired visibility', :aggregate_failures do
      user.settings[:default_privacy] = 'unlisted'
      user.save!

      expect(share(visibility: 'unlisted').visibility).to eq 'public'
      expect(share.visibility).to eq 'public'
    end
  end

  describe 'artists' do
    let(:write_token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
    let(:write_headers) { { 'Authorization' => "Bearer #{write_token.token}" } }
    let(:audio)         { Fabricate(:media_attachment, account: user.account) }
    let(:maddog)        { Fabricate(:account, username: 'maddog', display_name: 'Maddog') }
    let(:events)        { [] }

    before do
      user.account.update!(display_name: 'Ash')
      allow(Kronk::KornerEvents).to receive(:publish) { |name, **payload| events << [name, payload] }
    end

    def artists
      response.parsed_body['artists'].map { |a| [a.dig('account', 'username') || a['name'], a['verified']] }
    end

    it 'makes the uploader the artist, whatever name is typed', :aggregate_failures do
      post '/api/v1/booth_sets', headers: write_headers, params: { title: 'Sunrise', artist_name: 'DJ Somebody', audio_id: audio.id }

      expect(response).to have_http_status(200)
      expect(response.parsed_body['artist_name']).to eq 'Ash'
      expect(artists).to eq [[user.account.username, true]]
    end

    it 'credits a tagged account as unverified and a name as a name, and tells the account once', :aggregate_failures do
      params = { title: 'Sunrise', audio_id: audio.id, collaborators: [{ account_id: maddog.id }, { name: 'Lena K' }, { account_id: user.account.id }] }
      post '/api/v1/booth_sets', headers: write_headers, params: params, as: :json
      set_id = response.parsed_body['id']

      expect(response.parsed_body['artist_name']).to eq 'Ash, Maddog & Lena K'
      expect(artists).to eq [[user.account.username, true], ['maddog', false], ['Lena K', false]]
      expect(events).to eq [['booth.set.tagged', { actor_account_id: user.account.id, recipient_account_id: maddog.id, booth_set_id: set_id.to_i }]]

      patch "/api/v1/booth_sets/#{set_id}", headers: write_headers, params: { collaborators: [{ account_id: maddog.id }] }, as: :json

      expect(response.parsed_body['artist_name']).to eq 'Ash & Maddog'
      expect(events.size).to eq 1
    end

    it 'leaves a typed name from before credits alone until the artists are saved', :aggregate_failures do
      set = Fabricate(:booth_set, account: user.account, artist_name: 'Ash & Maddog')

      patch "/api/v1/booth_sets/#{set.id}", headers: write_headers, params: { title: 'Renamed' }
      expect(response.parsed_body['artist_name']).to eq 'Ash & Maddog'

      patch "/api/v1/booth_sets/#{set.id}", headers: write_headers, params: { collaborators: [] }, as: :json
      expect(response.parsed_body['artist_name']).to eq 'Ash'
    end

    it 'lets the tagged person confirm it or come off the set, and nobody else', :aggregate_failures do
      set = Fabricate(:booth_set, account: Fabricate(:account, display_name: 'Lena'), published: true)
      set.credits.create!(account: user.account)

      post "/api/v1/booth_sets/#{set.id}/confirm_credit", headers: write_headers
      expect(set.credits.first.reload).to be_verified

      delete "/api/v1/booth_sets/#{set.id}/credit", headers: write_headers
      expect(set.credits.reload).to be_empty
      expect(set.reload.artist_name).to eq 'Lena'

      post "/api/v1/booth_sets/#{set.id}/confirm_credit", headers: write_headers
      expect(response).to have_http_status(404)
    end
  end

  describe 'track lists' do
    let(:write_token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
    let(:write_headers) { { 'Authorization' => "Bearer #{write_token.token}" } }
    let(:audio)         { Fabricate(:media_attachment, account: user.account) }
    let(:text) do
      <<~TRACKS
        0:00 Floating Points - Silhouettes
        12:34 Four Tet – Baby

        1:02:03 Kelly Lee Owens - On
        [1:15:00] Untitled closer
        Jon Hopkins - Open Eye Signal
      TRACKS
    end

    it 'parses the text on create and serializes both shapes', :aggregate_failures do
      post '/api/v1/booth_sets', headers: write_headers,
                                 params: { title: 'Sunrise', artist_name: 'DJ', audio_id: audio.id, tracklist_text: text }

      expect(response).to have_http_status(200)
      expect(response.parsed_body['tracklist']).to eq [
        { 'start_seconds' => 0, 'artist' => 'Floating Points', 'title' => 'Silhouettes' },
        { 'start_seconds' => 754, 'artist' => 'Four Tet', 'title' => 'Baby' },
        { 'start_seconds' => 3723, 'artist' => 'Kelly Lee Owens', 'title' => 'On' },
        { 'start_seconds' => 4500, 'artist' => nil, 'title' => 'Untitled closer' },
        { 'start_seconds' => nil, 'artist' => 'Jon Hopkins', 'title' => 'Open Eye Signal' },
      ]
      expect(response.parsed_body['tracklist_text']).to eq <<~TRACKS.chomp
        0:00 Floating Points - Silhouettes
        12:34 Four Tet - Baby
        1:02:03 Kelly Lee Owens - On
        1:15:00 Untitled closer
        Jon Hopkins - Open Eye Signal
      TRACKS
    end

    it 'lets the owner replace and clear it, and nobody else change it', :aggregate_failures do
      set = Fabricate(:booth_set, account: user.account, tracklist_text: 'Old - Track')

      patch "/api/v1/booth_sets/#{set.id}", headers: write_headers, params: { tracklist_text: "3:00 New - Track\n" }
      expect(response.parsed_body['tracklist']).to eq [{ 'start_seconds' => 180, 'artist' => 'New', 'title' => 'Track' }]

      patch "/api/v1/booth_sets/#{set.id}", headers: write_headers, params: { tracklist_text: '' }
      expect(set.reload.tracklist).to eq []

      other = Fabricate(:booth_set, tracklist_text: 'Keep - Me')
      patch "/api/v1/booth_sets/#{other.id}", headers: write_headers, params: { tracklist_text: 'Hijack - It' }
      expect(response).to have_http_status(403)
      expect(other.reload.tracklist.first['title']).to eq 'Me'
    end

    it 'rejects more than the maximum number of tracks' do
      set = Fabricate(:booth_set, account: user.account)
      too_many = Array.new(BoothSet::TRACKLIST_MAX + 1) { |i| "Artist - Track #{i}" }.join("\n")

      patch "/api/v1/booth_sets/#{set.id}", headers: write_headers, params: { tracklist_text: too_many }

      expect(response).to have_http_status(422)
      expect(set.reload.tracklist).to eq []
    end

    it 'rejects a track name over the length limit' do
      set = Fabricate(:booth_set, account: user.account)

      patch "/api/v1/booth_sets/#{set.id}", headers: write_headers, params: { tracklist_text: "Artist - #{'x' * 201}" }

      expect(response).to have_http_status(422)
    end
  end

  # Albums and EPs (docs/spaces/booth.md, Albums): several tracks, each its
  # own audio file, in order, in place of one recording.
  describe 'albums' do
    let(:write_token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
    let(:write_headers) { { 'Authorization' => "Bearer #{write_token.token}" } }
    let(:files)         { Array.new(3) { Fabricate(:media_attachment, account: user.account) } }

    def create_album(tracks, kind: 'album')
      post '/api/v1/booth_sets', headers: write_headers, as: :json,
                                 params: { title: 'Tides', kind: kind, tracks: tracks }
    end

    def titles
      response.parsed_body['tracks'].pluck('title')
    end

    it 'creates an album with its tracks in the order given', :aggregate_failures do
      create_album([
        { audio_id: files[2].id, title: 'Low Water', duration_seconds: 200 },
        { audio_id: files[0].id, title: 'Undertow', duration_seconds: 180 },
        { audio_id: files[1].id, title: 'Slack Tide', duration_seconds: 240 },
      ])

      expect(response).to have_http_status(200)
      expect(response.parsed_body['kind']).to eq 'album'
      expect(titles).to eq ['Low Water', 'Undertow', 'Slack Tide']
      expect(response.parsed_body['tracks'].pluck('duration_seconds')).to eq [200, 180, 240]
      expect(response.parsed_body['tracks'].pluck('audio_url')).to all(be_present)
      expect(response.parsed_body['duration_seconds']).to eq 620
      expect(response.parsed_body['audio_url']).to eq response.parsed_body['tracks'].first['audio_url']
    end

    it 'shows the tracks in Musik' do
      create_album([{ audio_id: files[0].id, title: 'A' }, { audio_id: files[1].id, title: 'B' }], kind: 'ep')

      get '/api/v1/booth_sets', headers: headers

      row = response.parsed_body.find { |r| r['id'] == BoothSet.last.id.to_s }
      expect(row['tracks'].pluck('title')).to eq %w(A B)
    end

    it 'refuses an album with one track or no tracks', :aggregate_failures do
      create_album([{ audio_id: files[0].id, title: 'Alone' }])
      expect(response).to have_http_status(422)

      create_album([])
      expect(response).to have_http_status(422)
      expect(BoothSet.count).to eq 0
    end

    it "refuses someone else's file" do
      other = Fabricate(:media_attachment, account: Fabricate(:account))
      create_album([{ audio_id: files[0].id, title: 'Mine' }, { audio_id: other.id, title: 'Theirs' }])

      expect(response).to have_http_status(404)
    end

    it 'reorders, renames and removes tracks on update', :aggregate_failures do
      create_album(files.each_with_index.map { |file, i| { audio_id: file.id, title: "Track #{i + 1}" } })
      set_id = response.parsed_body['id']
      ids = response.parsed_body['tracks'].pluck('id')

      patch "/api/v1/booth_sets/#{set_id}", headers: write_headers, as: :json,
                                             params: { tracks: [{ id: ids[2], title: 'Opener' }, { id: ids[0] }] }

      expect(response).to have_http_status(200)
      expect(titles).to eq ['Opener', 'Track 1']
      expect(response.parsed_body['tracks'].pluck('id')).to eq [ids[2], ids[0]]
      expect(BoothSetTrack.where(booth_set_id: set_id).count).to eq 2
    end

    it 'leaves the tracks alone when an update does not send them' do
      create_album([{ audio_id: files[0].id, title: 'A' }, { audio_id: files[1].id, title: 'B' }])
      set_id = response.parsed_body['id']

      patch "/api/v1/booth_sets/#{set_id}", headers: write_headers, params: { title: 'Renamed' }

      expect(titles).to eq %w(A B)
    end

    it 'will not take an album below two tracks' do
      create_album([{ audio_id: files[0].id, title: 'A' }, { audio_id: files[1].id, title: 'B' }])
      set_id = response.parsed_body['id']
      ids = response.parsed_body['tracks'].pluck('id')

      patch "/api/v1/booth_sets/#{set_id}", headers: write_headers, as: :json, params: { tracks: [{ id: ids[0] }] }

      expect(response).to have_http_status(422)
      expect(BoothSetTrack.where(booth_set_id: set_id).count).to eq 2
    end

    it "does not let anyone else change an album's tracks" do
      set = BoothSet.new(account: Fabricate(:account), title: 'Theirs', artist_name: 'Lena', kind: 'album')
      2.times { |i| set.tracks.build(audio_attachment: Fabricate(:media_attachment, account: set.account), title: "T#{i}", position: i) }
      set.save!

      patch "/api/v1/booth_sets/#{set.id}", headers: write_headers, as: :json, params: { tracks: [{ id: set.tracks.last.id }] }

      expect(response).to have_http_status(403)
    end

    it 'keeps a set without a kind exactly as before', :aggregate_failures do
      post '/api/v1/booth_sets', headers: write_headers, params: { title: 'Warm-up', audio_id: files[0].id }

      expect(response).to have_http_status(200)
      expect(response.parsed_body['kind']).to eq 'mix'
      expect(response.parsed_body['tracks']).to eq []
      expect(response.parsed_body['audio_url']).to be_present
    end

    it 'refuses tracks on a set that is not an album or EP' do
      post '/api/v1/booth_sets', headers: write_headers, as: :json,
                                 params: { title: 'Warm-up', kind: 'mix', tracks: [{ audio_id: files[0].id, title: 'A' }, { audio_id: files[1].id, title: 'B' }] }

      expect(response).to have_http_status(422)
    end
  end
end
