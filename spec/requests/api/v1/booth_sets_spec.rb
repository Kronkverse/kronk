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
end
