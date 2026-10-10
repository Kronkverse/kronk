# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Kronk build' do
  describe 'GET /api/v1/kronk_build' do
    it 'returns the build id, uncached, without signing in' do
      get '/api/v1/kronk_build'

      expect(response).to have_http_status(200)
      expect(response.headers['Cache-Control']).to include('no-store')
      expect(response.parsed_body).to eq('build' => Kronk::Build.id)
    end

    it 'gives the same id on every request in a process' do
      get '/api/v1/kronk_build'
      first = response.parsed_body['build']
      get '/api/v1/kronk_build'

      expect(response.parsed_body['build']).to eq first
      expect(first).to be_present
    end
  end

  describe 'the page' do
    it 'carries the same id in a meta tag' do
      get '/'

      expect(response.parsed_body.at_css('meta[name="kronk-build"]')&.[]('content')).to eq Kronk::Build.id
    end
  end
end
