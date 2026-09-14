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
      expect(slugs).to include('about', 'values', 'governance', 'privacy')
      # First page in NAV_ORDER is `about`.
      expect(slugs.first).to eq('about')
    end

    it 'is publicly cacheable for anonymous readers' do
      get '/api/v1/kronk_pages'

      expect(response.headers['Cache-Control']).to include('public')
    end
  end

  describe 'GET /api/v1/kronk_pages/:page' do
    it 'returns a specific page' do
      get '/api/v1/kronk_pages/values'

      expect(response).to have_http_status(200)
      body = response.parsed_body
      expect(body['page']).to eq('values')
      expect(body['body_html']).to be_present
    end

    it 'returns 404 for unknown pages' do
      get '/api/v1/kronk_pages/not-a-real-page'

      expect(response).to have_http_status(404)
      expect(response.parsed_body['error']).to be_present
    end
  end
end
