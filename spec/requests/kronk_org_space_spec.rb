# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Kronk organisation space (/kronk/*)' do
  # 2026-09-14: /kronk was Rails-rendered until it became a real SPA
  # route mounted inside `KronkFrame`. The Rails controller now just
  # boots the SPA shell for these URLs; the SPA calls the JSON
  # endpoint (`Api::V1::KronkPagesController`) for content. So these
  # specs assert only that the Rails-served shell responds with 200
  # + is cacheable for anonymous readers. Content + 404 semantics
  # move to `spec/requests/api/v1/kronk_pages_spec.rb`.

  describe 'GET /kronk' do
    it 'serves the SPA shell for anonymous visitors' do
      get '/kronk'
      expect(response).to have_http_status(200)
      # Every SPA-shell response embeds the `#mastodon` mount point.
      expect(response.body).to include('id="mastodon"')
    end

    it 'is publicly cacheable for anonymous readers' do
      get '/kronk'
      expect(response.headers['Cache-Control']).to include('public')
    end
  end

  describe 'GET /kronk/:page' do
    it 'still serves the SPA shell for any valid page slug' do
      get '/kronk/values'
      expect(response).to have_http_status(200)
      expect(response.body).to include('id="mastodon"')
    end

    it 'serves the shell even for unknown slugs — the SPA renders the not-found state client-side' do
      get '/kronk/not-a-real-page'
      expect(response).to have_http_status(200)
    end
  end
end
