# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kollection.md, Admin.
RSpec.describe 'Admin Kollection apps' do
  let(:keeper) { Fabricate(:account) }
  let(:listing) do
    Kollection::SaveApp.new(KollectionApp.new(keeper: keeper), actor: keeper, params: { name: 'Anthemos', sign_in: true, redirect_uris: 'https://anthemos.example/cb' }).call
  end

  it 'is for admins only' do
    sign_in Fabricate(:user)
    get admin_kollection_apps_path

    expect(response).to have_http_status(403)
  end

  context 'with an admin' do
    before { sign_in Fabricate(:admin_user) }

    it 'lists the apps' do
      listing
      get admin_kollection_apps_path

      expect(response).to have_http_status(200)
      expect(response.body).to include('Anthemos')
    end

    it 'pulls an app: tokens revoked, sign-in refused, and restores it' do
      token = Fabricate(:access_token, application: listing.oauth_application, resource_owner_id: Fabricate(:user).id)

      post pull_admin_kollection_app_path(listing)

      expect(listing.reload).to be_pulled
      expect(token.reload.revoked_at).to be_present
      expect(Doorkeeper::Application.by_uid(listing.oauth_application.uid)).to be_nil

      post restore_admin_kollection_app_path(listing)

      expect(listing.reload).to be_live
      expect(Doorkeeper::Application.by_uid(listing.oauth_application.uid)).to eq listing.oauth_application
    end

    it 'names a new keeper by username' do
      someone = Fabricate(:user, account: Fabricate(:account, username: 'kashka'))

      patch keeper_admin_kollection_app_path(listing), params: { username: '@kashka' }

      expect(listing.reload.keeper).to eq someone.account
    end
  end
end
