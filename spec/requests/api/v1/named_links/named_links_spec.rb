# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Pages by name' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:other)   { Fabricate(:account) }

  describe 'albums' do
    let!(:album) { Album.create!(owner: user.account, title: 'Beach Day', visibility: :public) }

    it 'opens by name, old name and number' do
      album.update!(title: 'Dune Walk')

      ['dune-walk', 'beach-day', album.id.to_s].each do |link|
        get "/api/v1/albutts/albums/#{link}", headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body['slug']).to eq 'dune-walk'
      end
    end

    it 'answers not found, not forbidden, for an album the viewer cannot see' do
      hidden = Album.create!(owner: other, title: 'Secret', visibility: :self_only)

      get "/api/v1/albutts/albums/#{hidden.slug}", headers: headers

      expect(response).to have_http_status(404)
    end
  end

  describe 'events' do
    it 'answers not found, not forbidden, for an invite-only event' do
      event = Event.create!(account: other, title: 'Party', start_time: 1.day.from_now, invite_only: true)

      get "/api/v1/events/#{event.slug}", headers: headers

      expect(response).to have_http_status(404)
    end

    it 'takes a new name when the title changes' do
      event = Event.create!(account: user.account, title: 'Picnic', start_time: 1.day.from_now)

      put "/api/v1/events/#{event.id}", headers: headers, params: { title: 'Swim' }

      expect(response.parsed_body['slug']).to eq 'swim'
      get '/api/v1/events/picnic', headers: headers
      expect(response.parsed_body['id']).to eq event.id.to_s
    end
  end

  describe 'emergences' do
    it 'opens by name and number' do
      project = Freethedream::Project.create!(owner: user.account, title: 'Community Garden')

      [project.slug, project.id.to_s].each do |link|
        get "/api/v1/freethedream/projects/#{link}", headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body['slug']).to eq 'community-garden'
      end
    end
  end

  describe 'listings' do
    it 'opens by name and number, and hides a draft' do
      listing = Listing.create!(account: other, title: 'Lemon Soap', category: 'goods', state: 'live')

      [listing.slug, listing.id.to_s].each do |link|
        get "/api/v1/wachuneed/listings/#{link}", headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body['slug']).to eq 'lemon-soap'
      end

      draft = Listing.create!(account: other, title: 'Not Yet', category: 'goods', state: 'draft')
      get "/api/v1/wachuneed/listings/#{draft.slug}", headers: headers
      expect(response).to have_http_status(404)
    end
  end

  describe 'emergence items' do
    it 'opens by name and number' do
      project = Freethedream::Project.create!(owner: user.account, title: 'Community Garden')
      item = Freethedream::Item.create!(root: project, owner: user.account, kind: :need, title: 'Gas bottle', quantity: 2)

      [item.slug, item.id.to_s].each do |link|
        get "/api/v1/freethedream/items/#{link}", headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body['slug']).to eq 'gas-bottle'
      end
    end
  end
end
