# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Attachments::Candidates' do
  # Shared candidates search — the picker's "what could I attach to?"
  # backend (docs/kronk_korner_attachments.md §4.3). Uses the real
  # Kalendar (Event) + Albutts (Album) manifests + models, so this
  # spec doubles as a smoke test for `Kronk::KornerRegistry.model_for`.

  let(:user) { Fabricate(:user) }
  let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  before do
    Kronk::KornerRegistry.reload!
  end

  describe 'GET /api/v1/attachments/candidates' do
    it 'returns 422 for an unknown korner' do
      get '/api/v1/attachments/candidates?korner=nowhere', headers: headers
      expect(response).to have_http_status(422)
    end

    it 'returns the user\'s Kalendar events matching a query' do
      Event.create!(
        account: user.account,
        title: 'Alice\'s birthday',
        start_time: 2.days.from_now,
        end_time: 2.days.from_now + 2.hours
      )
      Event.create!(
        account: user.account,
        title: 'Bob\'s wedding',
        start_time: 1.week.from_now,
        end_time: 1.week.from_now + 4.hours
      )

      get '/api/v1/attachments/candidates?korner=kalendar&q=alice', headers: headers

      expect(response).to have_http_status(200)
      titles = response.parsed_body.pluck('title')
      expect(titles).to include('Alice\'s birthday')
      expect(titles).to_not include('Bob\'s wedding')
    end

    it 'returns the user\'s Albutts albums with no query' do
      Album.create!(owner: user.account, title: 'Roadtrip', visibility: :public)

      get '/api/v1/attachments/candidates?korner=albutts', headers: headers

      expect(response).to have_http_status(200)
      titles = response.parsed_body.pluck('title')
      expect(titles).to include('Roadtrip')
    end

    it 'serialises each hit with slug + id + title + url' do
      album = Album.create!(owner: user.account, title: 'Test album', visibility: :public)

      get '/api/v1/attachments/candidates?korner=albutts&q=Test', headers: headers

      row = response.parsed_body.first
      expect(row).to include(
        'slug' => 'albutts',
        'id' => album.id.to_s,
        'title' => 'Test album',
        'url' => "/hub/albutts/#{album.id}"
      )
    end
  end
end
