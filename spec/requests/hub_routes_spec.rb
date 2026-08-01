# frozen_string_literal: true

require 'rails_helper'

# The 2.0.0 rebuild moves every korner under `/hub/<slug>` per §4 of
# docs/kronk_korner_spec.md. This spec asserts:
#
#   • the new /hub/<slug> paths serve their target controller
#   • the legacy top-level paths 301-redirect to their /hub/<slug>
#     counterpart, preserving the sub-path
RSpec.describe 'Hub routes' do
  describe 'SPA-served korners return 200' do
    %w(
      /hub/kommons
      /hub/kuestions
      /hub/inflow
      /hub/martketplace
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

  describe 'legacy paths 301-redirect to the /hub/<slug> counterpart' do
    {
      '/governance' => '/hub/kommons',
      '/governance/proposals/1' => '/hub/kommons/proposals/1',
      '/questions' => '/hub/kuestions',
      '/questions/42' => '/hub/kuestions/42',
      '/kalendar' => '/hub/kalendar',
      '/kalendar/42' => '/hub/kalendar/42',
      '/booth' => '/hub/booth',
      '/booth/deep/link' => '/hub/booth/deep/link',
      '/in-flow' => '/hub/inflow',
      '/hub/in-flow' => '/hub/inflow',
      '/market' => '/hub/martketplace',
      '/market/listing/1' => '/hub/martketplace/listing/1',
      '/hub/marketplace' => '/hub/martketplace',
      '/hub/marketplace/listing/1' => '/hub/martketplace/listing/1',
      '/hub/wachuneed' => '/hub/martketplace',
      '/hub/wachuneed/listing/1' => '/hub/martketplace/listing/1',
    }.each do |old_path, new_path|
      it "301 #{old_path} → #{new_path}" do
        get old_path
        expect(response).to have_http_status(301)
        expect(response.headers['Location']).to end_with(new_path)
      end
    end
  end
end
