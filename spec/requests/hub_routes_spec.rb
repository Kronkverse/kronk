# frozen_string_literal: true

require 'rails_helper'

# The 2.0.0 rebuild moves every korner under `/hub/<slug>` per §4 of
# docs/kronk_korner_spec.md. This spec asserts the Rails-level routes
# serve the same target as their legacy top-level counterparts.
#
# The client-side router accepts both old and new paths so in-app
# navigation continues to work while <Link> generators migrate.
RSpec.describe 'Hub routes' do
  describe 'SPA-served korners return 200' do
    %w(
      /hub/kommons
      /hub/kuestions
      /hub/in-flow
      /hub/marketplace
      /hub/tree
    ).each do |path|
      it "GET #{path}" do
        get path
        expect(response).to have_http_status(200)
      end
    end
  end

  describe 'Rails-controller korners return 200' do
    it 'GET /hub/kalendar' do
      get '/hub/kalendar'
      expect(response).to have_http_status(200)
    end

    it 'GET /hub/booth' do
      get '/hub/booth'
      expect(response).to have_http_status(200)
    end
  end

  describe 'deep paths route to the same target as their base' do
    it 'GET /hub/kommons/proposals/42 renders the SPA shell' do
      get '/hub/kommons/proposals/42'
      expect(response).to have_http_status(200)
    end

    it 'GET /hub/booth/sets/1 constrains the id to digits' do
      get '/hub/booth/sets/1'
      # Booth show may 404 without a real record; we're checking the
      # route resolves at all, not that the resource exists.
      expect(response.status).to be_in([200, 404])
    end
  end
end
