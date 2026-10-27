# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kronikles.md, Series.
RSpec.describe 'Kronikles Series' do
  let(:writer) { Fabricate(:user) }
  let(:reader) { Fabricate(:user) }
  let(:series) { ChronicleSeries.create!(owner: writer.account, title: 'The long walk', description: 'Three days on foot.') }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def chapter(title, visibility: :public, into: series)
    Chronicle.create!(owner: writer.account, title: title, body: "#{title}.", kind: :short_story, visibility: visibility, series: into)
  end

  describe 'GET /api/v1/kronikles/series/:id' do
    it 'counts only the chapters the reader can see' do
      chapter('Setting out')
      chapter('Just for me', visibility: :self_only)

      get "/api/v1/kronikles/series/#{series.id}", headers: headers_for(reader)

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include(title: 'The long walk', description: 'Three days on foot.', chapter_count: 1, is_owner: false)
      expect(response.parsed_body).to_not have_key(:cover_id)
    end

    it 'is not there for a reader who can see none of its chapters' do
      chapter('Just for me', visibility: :self_only)

      get "/api/v1/kronikles/series/#{series.id}", headers: headers_for(reader)

      expect(response).to have_http_status(404)
    end

    it 'is there for its owner, even empty' do
      get "/api/v1/kronikles/series/#{series.id}", headers: headers_for(writer)

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include(chapter_count: 0, is_owner: true)
    end
  end

  describe 'GET /api/v1/kronikles/series/:id/chapters' do
    it 'lists the chapters the reader can see, in order' do
      first = chapter('Setting out')
      chapter('Just for me', visibility: :self_only)
      third = chapter('The river')

      get "/api/v1/kronikles/series/#{series.id}/chapters", headers: headers_for(reader)

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck(:id)).to eq [first.id.to_s, third.id.to_s]
    end

    it 'is a 404 when the reader can see none of them' do
      chapter('Just for me', visibility: :self_only)

      get "/api/v1/kronikles/series/#{series.id}/chapters", headers: headers_for(reader)

      expect(response).to have_http_status(404)
    end
  end

  describe 'a chapter, read on its own' do
    it 'says its Series, its number among what the reader can see, and its neighbours' do
      first = chapter('Setting out')
      chapter('Just for me', visibility: :self_only)
      third = chapter('The river')

      get "/api/v1/kronikles/chronicles/#{third.id}", headers: headers_for(reader)

      expect(response.parsed_body[:series]).to include(id: series.id.to_s, title: 'The long walk', chapter_count: 2)
      expect(response.parsed_body[:chapter]).to eq('number' => 2, 'count' => 2, 'previous_id' => first.id.to_s, 'next_id' => nil)
    end

    it 'has no Series when it is in none' do
      loose = chapter('On its own', into: nil)

      get "/api/v1/kronikles/chronicles/#{loose.id}", headers: headers_for(reader)

      expect(response.parsed_body).to include(series: nil, chapter: nil)
    end
  end

  describe 'GET /api/v1/kronikles/chronicles' do
    it 'shows a Series once, as its newest chapter the reader can see' do
      chapter('Setting out')
      newest = chapter('The river')
      chapter('Just for me', visibility: :self_only)
      loose = chapter('On its own', into: nil)

      get '/api/v1/kronikles/chronicles', headers: headers_for(reader)

      expect(response.parsed_body.pluck(:id)).to contain_exactly(newest.id.to_s, loose.id.to_s)
      expect(response.parsed_body.find { |c| c[:id] == newest.id.to_s }[:series]).to include(chapter_count: 2)
    end

    it 'lists every chapter with series=each' do
      first = chapter('Setting out')
      second = chapter('The river')

      get '/api/v1/kronikles/chronicles', params: { series: 'each' }, headers: headers_for(reader)

      expect(response.parsed_body.pluck(:id)).to contain_exactly(first.id.to_s, second.id.to_s)
    end
  end

  describe 'GET /api/v1/kronikles/series' do
    it 'lists what the reader can see, and with scope=mine only their own' do
      chapter('Setting out')
      hidden = ChronicleSeries.create!(owner: writer.account, title: 'Notebook')
      Chronicle.create!(owner: writer.account, title: 'Private', body: 'x', visibility: :self_only, series: hidden)
      own = ChronicleSeries.create!(owner: reader.account, title: 'Empty yet')

      get '/api/v1/kronikles/series', headers: headers_for(reader)
      expect(response.parsed_body.pluck(:id)).to contain_exactly(series.id.to_s, own.id.to_s)

      get '/api/v1/kronikles/series', params: { scope: 'mine' }, headers: headers_for(reader)
      expect(response.parsed_body.pluck(:id)).to eq [own.id.to_s]
    end
  end

  describe 'writing' do
    it 'makes a Series with an owner’s own cover' do
      cover = Fabricate(:media_attachment, account: writer.account, type: :image)

      post '/api/v1/kronikles/series', headers: headers_for(writer), params: { series: { title: 'Letters home', cover_media_attachment_id: cover.id } }

      expect(response).to have_http_status(201)
      expect(ChronicleSeries.last).to have_attributes(owner: writer.account, title: 'Letters home', cover_media_attachment_id: cover.id)
      expect(response.parsed_body[:cover_id]).to eq cover.id.to_s
    end

    it 'refuses someone else’s upload as the cover' do
      theirs = Fabricate(:media_attachment, account: reader.account, type: :image)

      post '/api/v1/kronikles/series', headers: headers_for(writer), params: { series: { title: 'Letters home', cover_media_attachment_id: theirs.id } }

      expect(response).to have_http_status(422)
    end

    it 'lets only the owner change or delete it' do
      chapter('Setting out')

      put "/api/v1/kronikles/series/#{series.id}", headers: headers_for(reader), params: { series: { title: 'Mine now' } }
      expect(response).to have_http_status(403)

      delete "/api/v1/kronikles/series/#{series.id}", headers: headers_for(reader)
      expect(response).to have_http_status(403)
      expect(series.reload.title).to eq 'The long walk'
    end

    it 'keeps the Kronikles when the Series is deleted' do
      first = chapter('Setting out')

      delete "/api/v1/kronikles/series/#{series.id}", headers: headers_for(writer)

      expect(response).to have_http_status(200)
      expect(ChronicleSeries.exists?(series.id)).to be false
      expect(first.reload).to have_attributes(series_id: nil, series_position: nil)
    end
  end

  describe 'PUT /api/v1/kronikles/series/:id/reorder' do
    it 'puts the chapters in the owner’s order' do
      first = chapter('Setting out')
      second = chapter('The river')

      put "/api/v1/kronikles/series/#{series.id}/reorder", headers: headers_for(writer), params: { chapter_ids: [second.id, first.id] }

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck(:id)).to eq [second.id.to_s, first.id.to_s]
      expect(series.chapters.reload).to eq [second, first]
    end

    it 'refuses an order that misses a chapter' do
      first = chapter('Setting out')
      second = chapter('The river')

      put "/api/v1/kronikles/series/#{series.id}/reorder", headers: headers_for(writer), params: { chapter_ids: [second.id] }

      expect(response).to have_http_status(422)
      expect(series.chapters.reload).to eq [first, second]
    end

    it 'is only for the owner' do
      first = chapter('Setting out')
      second = chapter('The river')

      put "/api/v1/kronikles/series/#{series.id}/reorder", headers: headers_for(reader), params: { chapter_ids: [second.id, first.id] }

      expect(response).to have_http_status(403)
      expect(series.chapters.reload).to eq [first, second]
    end
  end

  describe 'adding and taking out chapters' do
    it 'adds one of the owner’s Kronikles at the end, and takes it out again' do
      first = chapter('Setting out')
      loose = chapter('Later', into: nil)

      post "/api/v1/kronikles/series/#{series.id}/chapters", headers: headers_for(writer), params: { chronicle_id: loose.id }

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck(:id)).to eq [first.id.to_s, loose.id.to_s]

      delete "/api/v1/kronikles/series/#{series.id}/chapters/#{first.id}", headers: headers_for(writer)

      expect(response.parsed_body.pluck(:id)).to eq [loose.id.to_s]
      expect(first.reload.series_id).to be_nil
    end

    it 'won’t take someone else’s Kronikle' do
      theirs = Chronicle.create!(owner: reader.account, title: 'Mine', body: 'Mine.', visibility: :public)

      post "/api/v1/kronikles/series/#{series.id}/chapters", headers: headers_for(writer), params: { chronicle_id: theirs.id }

      expect(response).to have_http_status(404)
      expect(theirs.reload.series_id).to be_nil
    end

    it 'won’t let anyone else add to it' do
      chapter('Setting out')
      theirs = Chronicle.create!(owner: reader.account, title: 'Mine', body: 'Mine.', visibility: :public)

      post "/api/v1/kronikles/series/#{series.id}/chapters", headers: headers_for(reader), params: { chronicle_id: theirs.id }

      expect(response).to have_http_status(403)
    end

    it 'puts a new Kronikle straight into a Series from the composer, but only the writer’s own' do
      post '/api/v1/kronikles/chronicles', headers: headers_for(writer), params: { chronicle: { title: 'Day two', body: 'Rain.', kind: 'short_story', visibility: 'public', series_id: series.id } }

      expect(response).to have_http_status(201)
      expect(response.parsed_body[:series]).to include(id: series.id.to_s)
      expect(response.parsed_body[:chapter]).to include(number: 1, count: 1)

      post '/api/v1/kronikles/chronicles', headers: headers_for(reader), params: { chronicle: { title: 'Sneaking in', body: 'Hi.', kind: 'essay', visibility: 'public', series_id: series.id } }

      expect(response).to have_http_status(422)
    end
  end
end
