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
      # Every SPA-shell response embeds the `#mastodon` mount point. Matched
      # without assuming how the attribute is quoted: Haml emits single quotes
      # (`id='mastodon'`), so asserting the double-quoted form could never
      # have passed — and did not, from the moment this was written.
      expect(response.body).to match(/id=['"]mastodon['"]/)
    end

    it 'is publicly cacheable for anonymous readers' do
      get '/kronk'
      expect(response.headers['Cache-Control']).to include('public')
    end
  end

  describe 'GET /kronk/:page' do
    it 'still serves the SPA shell for any valid page slug' do
      get '/kronk/governance'
      expect(response).to have_http_status(200)
      expect(response.body).to match(/id=['"]mastodon['"]/)
    end

    it 'serves the shell even for unknown slugs — the SPA renders the not-found state client-side' do
      get '/kronk/not-a-real-page'
      expect(response).to have_http_status(200)
    end
  end

  describe 'retired slugs (2026-09-15 consolidation)' do
    it 'redirects /kronk/values → /kronk (folded into about)' do
      get '/kronk/values'
      expect(response).to redirect_to('/kronk')
      expect(response).to have_http_status(301)
    end

    it 'redirects /kronk/contact → /kronk/contributors' do
      get '/kronk/contact'
      expect(response).to redirect_to('/kronk/contributors')
      expect(response).to have_http_status(301)
    end

    it 'redirects /kronk/announcements → /kronk' do
      get '/kronk/announcements'
      expect(response).to redirect_to('/kronk')
      expect(response).to have_http_status(301)
    end
  end
end
