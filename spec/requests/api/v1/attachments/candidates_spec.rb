# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Attachments::Candidates' do
  # Shared candidates search — the picker's "what could I attach to?"
  # backend (docs/korners/adding_a_korner.md (Korner attachments) §4.3). Uses the real
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

    it 'offers upcoming Kalendar events, and past ones when asked' do
      Event.create!(account: user.account, title: 'Last picnic', start_time: 3.days.ago, end_time: 3.days.ago + 2.hours)
      Event.create!(account: user.account, title: 'Next picnic', start_time: 3.days.from_now, end_time: 3.days.from_now + 2.hours)

      get '/api/v1/attachments/candidates?korner=kalendar&q=picnic', headers: headers
      expect(response.parsed_body.pluck('title')).to eq ['Next picnic']

      get '/api/v1/attachments/candidates?korner=kalendar&q=picnic&past=1', headers: headers
      expect(response.parsed_body.pluck('title')).to eq ['Last picnic']
    end

    # A composer opened with `?konnect=<slug>:<id>` looks its source up by id
    # for the tile's title. The visibility scopes used to replace the id
    # condition, so the tile named the newest Krew or event instead.
    it 'looks a Krew up by id, not the newest one the viewer can find' do
      mine = Krew.create!(slug: 'mainframe', name: 'Mainframe', access: 'open')
      mine.krew_memberships.create!(account: user.account, role: 'member', source: 'direct')
      newer = Krew.create!(slug: 'mayhem', name: 'Mayhem New Years', access: 'open')
      newer.krew_memberships.create!(account: user.account, role: 'member', source: 'direct')

      get "/api/v1/attachments/candidates?korner=krew&id=#{mine.id}", headers: headers

      expect(response.parsed_body.pluck('title')).to eq ['Mainframe']
      # It says what it is, beside a title another record may share.
      expect(response.parsed_body.pluck('noun')).to eq ['Krew']
    end

    it 'looks an event up by id, not the newest one the viewer can see' do
      first = Event.create!(account: user.account, title: 'Dawn swim', start_time: 3.days.from_now, end_time: 3.days.from_now + 1.hour)
      Event.create!(account: user.account, title: 'Dusk swim', start_time: 4.days.from_now, end_time: 4.days.from_now + 1.hour)

      get "/api/v1/attachments/candidates?korner=kalendar&id=#{first.id}", headers: headers

      expect(response.parsed_body.pluck('title')).to eq ['Dawn swim']
    end

    it 'says when each Kalendar event starts' do
      event = Event.create!(account: user.account, title: 'Dawn swim', start_time: 3.days.from_now, end_time: 3.days.from_now + 1.hour)

      get '/api/v1/attachments/candidates?korner=kalendar&q=dawn', headers: headers

      expect(response.parsed_body.first['starts_at']).to eq(event.start_time.iso8601)
    end

    it 'returns the user\'s Albutts albums with no query' do
      Album.create!(owner: user.account, title: 'Roadtrip', visibility: :public)

      get '/api/v1/attachments/candidates?korner=albutts', headers: headers

      expect(response).to have_http_status(200)
      titles = response.parsed_body.pluck('title')
      expect(titles).to include('Roadtrip')
    end

    it 'finds one record by id, past events included, for a composer opened to Konnect it' do
      event = Event.create!(account: user.account, title: 'Last picnic', start_time: 3.days.ago, end_time: 3.days.ago + 2.hours)
      Event.create!(account: user.account, title: 'Next picnic', start_time: 3.days.from_now, end_time: 3.days.from_now + 2.hours)

      get "/api/v1/attachments/candidates?korner=kalendar&id=#{event.id}", headers: headers
      expect(response.parsed_body.pluck('title')).to eq ['Last picnic']

      hidden = Album.create!(owner: Fabricate(:account), title: 'Private', visibility: :self_only)
      get "/api/v1/attachments/candidates?korner=albutts&id=#{hidden.id}", headers: headers
      expect(response.parsed_body).to eq []
    end

    # Event.visible_to only settles invite-only; the event's reach comes
    # from its post (Event#visible_to?), so a Mates-only or unposted event
    # by someone else used to be listed with its title and date.
    it "offers only events the viewer could open, not someone else's Mates-only or unposted one" do
      host = Fabricate(:account)
      mates_only = Fabricate(:status, account: host, visibility: :private)
      hidden = Event.create!(account: host, title: 'Garden party (Mates)', status: mates_only, start_time: 2.days.from_now)
      Event.create!(account: host, title: 'Garden party (draft)', start_time: 2.days.from_now)
      Event.create!(account: host, title: 'Garden party (open)', status: Fabricate(:status, account: host, visibility: :public),
                    start_time: 2.days.from_now)

      get '/api/v1/attachments/candidates?korner=kalendar&q=garden', headers: headers
      expect(response.parsed_body.pluck('title')).to eq ['Garden party (open)']

      get "/api/v1/attachments/candidates?korner=kalendar&id=#{hidden.id}", headers: headers
      expect(response.parsed_body).to eq []
    end

    it 'serialises each hit with slug + id + title + url' do
      album = Album.create!(owner: user.account, title: 'Test album', visibility: :public)

      get '/api/v1/attachments/candidates?korner=albutts&q=Test', headers: headers

      row = response.parsed_body.first
      expect(row).to include(
        'slug' => 'albutts',
        'id' => album.id.to_s,
        'title' => 'Test album',
        'url' => "/hub/albutts/albums/#{album.id}"
      )
    end
  end
end
