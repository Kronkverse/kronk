# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Kronk organisation space (/kronk/*)' do
  describe 'GET /kronk' do
    it 'renders the about page as the default' do
      get '/kronk'
      expect(response).to have_http_status(200)
      expect(response.body).to include('About Kronk')
    end
  end

  describe 'GET /kronk/values' do
    it 'renders the values markdown' do
      get '/kronk/values'
      expect(response).to have_http_status(200)
      expect(response.body).to include('Values')
    end
  end

  describe 'GET /kronk/governance' do
    it 'renders the governance markdown' do
      get '/kronk/governance'
      expect(response).to have_http_status(200)
      expect(response.body).to include('Governance')
    end
  end

  describe 'GET /kronk/privacy' do
    it 'renders the instance-layer privacy stub' do
      get '/kronk/privacy'
      expect(response).to have_http_status(200)
      expect(response.body).to include('Privacy')
    end
  end

  describe 'GET /kronk/not-a-real-page' do
    it 'returns 404 with a stub body' do
      get '/kronk/not-a-real-page'
      expect(response).to have_http_status(404)
      expect(response.body).to include('No content')
    end
  end
end
