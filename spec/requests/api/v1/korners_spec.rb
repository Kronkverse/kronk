# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Korners' do
  before { Kronk::KornerRegistry.reload! }

  describe 'GET /api/v1/korners' do
    it 'returns http success and an array of korner manifests' do
      get api_v1_korners_path

      expect(response).to have_http_status(200)
      expect(response.content_type).to start_with('application/json')

      body = response.parsed_body
      expect(body).to be_an(Array)
      expect(body).to_not be_empty

      slugs = body.pluck('slug')
      expect(slugs).to include('kommons', 'kalendar', 'booth')
    end

    it 'exposes the manifest structural fields on each korner' do
      get api_v1_korners_path

      kommons = response.parsed_body.find { |k| k['slug'] == 'kommons' }
      expect(kommons).to include(
        'slug' => 'kommons',
        'name' => 'Kommons',
        'enforced' => true
      )
      expect(kommons).to have_key('resources')
      expect(kommons).to have_key('storage')
      expect(kommons).to have_key('feed_projection')
    end
  end

  describe 'GET /api/v1/korners/:slug' do
    it 'returns a single korner manifest' do
      get api_v1_korner_path(id: 'kommons')

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('slug' => 'kommons', 'name' => 'Kommons')
    end

    it 'returns 404 for an unknown slug' do
      get api_v1_korner_path(id: 'does-not-exist')

      expect(response).to have_http_status(404)
    end

    it 'resolves hyphenated slugs' do
      get api_v1_korner_path(id: 'in-flow')

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('slug' => 'in-flow')
    end
  end
end
