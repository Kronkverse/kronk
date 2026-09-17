# frozen_string_literal: true

require 'rails_helper'

# Authorization guards on Map treks. Mutating actions (destroy/publish/unpublish)
# must be scoped strictly to the owner — a stranger must not be able to delete
# another user's trek or force-publish their private draft.
RSpec.describe 'Api::V1::Map::Treks authorization' do
  let(:owner)    { Fabricate(:account) }
  let(:trek)     { Trek.create!(account: owner, recorded_at: Time.zone.now) }

  let(:stranger) { Fabricate(:user) }
  let(:token)    { Fabricate(:accessible_access_token, resource_owner_id: stranger.id, scopes: 'read write') }
  let(:headers)  { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'DELETE /api/v1/map/treks/:id as a stranger' do
    it 'is not found and does not delete the trek' do
      expect do
        delete "/api/v1/map/treks/#{trek.id}", headers: headers
      end.to_not(change { Trek.where(id: trek.id).count })

      expect(response).to have_http_status(404)
    end
  end

  describe 'POST /api/v1/map/treks/:id/publish as a stranger' do
    it 'is not found and does not publish the trek' do
      post "/api/v1/map/treks/#{trek.id}/publish", headers: headers

      expect(response).to have_http_status(404)
      expect(trek.reload.state).to eq('draft')
    end
  end

  describe 'DELETE /api/v1/map/treks/:id as the owner' do
    let(:owner_user) { Fabricate(:user, account: owner) }
    let(:token)      { Fabricate(:accessible_access_token, resource_owner_id: owner_user.id, scopes: 'read write') }

    it 'deletes the trek' do
      trek # create it
      expect do
        delete "/api/v1/map/treks/#{trek.id}", headers: headers
      end.to change { Trek.where(id: trek.id).count }.from(1).to(0)

      expect(response).to have_http_status(204)
    end
  end
end
