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
end
