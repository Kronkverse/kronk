# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Kronk Pages' do
  describe 'GET /api/v1/kronk_pages' do
    it 'returns the about page by default' do
      get '/api/v1/kronk_pages'

      expect(response).to have_http_status(200)
      body = response.parsed_body
      expect(body['page']).to eq('about')
      expect(body['title']).to eq('About Kronk')
      expect(body['body_html']).to be_present
    end

    it 'includes the nav_pages catalogue for the SPA wheel' do
      get '/api/v1/kronk_pages'

      body = response.parsed_body
      expect(body['nav_pages']).to be_an(Array)
      slugs = body['nav_pages'].pluck('slug')
      expect(slugs).to include('about', 'governance', 'contributors', 'privacy')
      # First page in NAV_ORDER is `about`.
      expect(slugs.first).to eq('about')
    end

    it 'excludes the retired pages (announcements, values, contact)' do
      get '/api/v1/kronk_pages'

      slugs = response.parsed_body['nav_pages'].pluck('slug')
      expect(slugs).to_not include('announcements', 'values', 'contact')
    end

    it 'is publicly cacheable for anonymous readers' do
      get '/api/v1/kronk_pages'

      expect(response.headers['Cache-Control']).to include('public')
    end
  end

  describe 'GET /api/v1/kronk_pages/:page' do
    it 'returns a specific page' do
      get '/api/v1/kronk_pages/governance'

      expect(response).to have_http_status(200)
      body = response.parsed_body
      expect(body['page']).to eq('governance')
      expect(body['body_html']).to be_present
    end

    it 'returns 404 for unknown pages (incl. retired slugs)' do
      %w(not-a-real-page announcements values contact).each do |slug|
        get "/api/v1/kronk_pages/#{slug}"

        expect(response).to have_http_status(404), "expected 404 for #{slug}"
        expect(response.parsed_body['error']).to be_present
      end
    end
  end
end
