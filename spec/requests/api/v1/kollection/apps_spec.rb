# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kollection.md.
RSpec.describe 'Kollection apps API' do
  let(:user)    { Fabricate(:user) }
  let(:scopes)  { 'read write' }
  let(:headers) { headers_for(user) }

  def headers_for(someone)
    token = Fabricate(:accessible_access_token, resource_owner_id: someone.id, scopes: scopes)
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def add_app(keeper, name = 'Anthemos', **params)
    Kollection::SaveApp.new(KollectionApp.new(keeper: keeper), actor: keeper, params: { name: name, sign_in: true, redirect_uris: "anthemos://kronk\nhttps://pod.anthemos.example/callback" }.merge(params)).call
  end

  def connect(someone, app)
    Fabricate(:access_token, application: app.oauth_application, resource_owner_id: someone.id, scopes: 'openid profile')
  end

  describe 'POST /api/v1/kollection/apps' do
    it 'adds an app that signs in with Kronk, kept by you and owned by no one' do
      post '/api/v1/kollection/apps', headers: headers, params: {
        name: 'Anthemos', description: 'Connects Anthemos to Kronk.', website: 'https://anthemos.example',
        sign_in: true, redirect_uris: "anthemos://kronk\nhttps://pod.anthemos.example/callback", scopes: %w(openid profile)
      }

      expect(response).to have_http_status(200)
      body = response.parsed_body
      expect(body).to include('name' => 'Anthemos', 'signs_in' => true, 'status' => 'live', 'is_keeper' => true,
                              'can_manage' => true, 'scopes' => %w(openid profile), 'connected' => false)
      expect(body['redirect_uris']).to eq %w(anthemos://kronk https://pod.anthemos.example/callback)
      expect(body['client_id']).to be_present
      expect(body['client_secret']).to be_present

      app = KollectionApp.find(body['id'])
      expect(app.keeper).to eq user.account
      expect(app.oauth_application).to have_attributes(owner: nil, confidential: true, uid: body['client_id'])
      expect(user.applications).to be_empty
    end

    it 'adds a link with no sign-in' do
      post '/api/v1/kollection/apps', headers: headers, params: { name: 'YOU', website: 'https://you.example' }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('signs_in' => false, 'scopes' => [])
      expect(response.parsed_body).to_not have_key('client_id')
      expect(Doorkeeper::Application.count).to eq 1 # only the test token's own app
    end

    it 'needs a website for a link, and a redirect URI to sign in' do
      post '/api/v1/kollection/apps', headers: headers, params: { name: 'Nowhere' }
      expect(response).to have_http_status(422)

      post '/api/v1/kollection/apps', headers: headers, params: { name: 'Nowhere', sign_in: true, redirect_uris: '' }
      expect(response).to have_http_status(422)
      expect(KollectionApp.count).to eq 0
    end

    it 'offers only its own scopes' do
      post '/api/v1/kollection/apps', headers: headers, params: {
        name: 'Greedy', sign_in: true, redirect_uris: 'https://greedy.example/cb', scopes: %w(read admin:write)
      }

      expect(KollectionApp.last.scopes).to eq %w(read)
    end
  end

  describe 'GET /api/v1/kollection/apps' do
    it 'is for members only' do
      get '/api/v1/kollection/apps'

      expect(response).to have_http_status(401)
    end

    it 'lists live apps, shows the keys only to their keeper, and says whether you are connected' do
      keeper = Fabricate(:account)
      kept = add_app(keeper)
      connect(user, kept)
      pulled = add_app(keeper, 'Gone')
      pulled.pull!

      get '/api/v1/kollection/apps', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck('name')).to eq %w(Anthemos)
      row = response.parsed_body.first
      expect(row).to include('connected' => true, 'is_keeper' => false, 'can_manage' => false)
      expect(row).to_not have_key('client_secret')
      expect(row).to_not have_key('redirect_uris')
      expect(row['keeper']).to include('id' => keeper.id.to_s)
    end

    it 'shows an admin the keys' do
      admin = Fabricate(:admin_user)
      add_app(Fabricate(:account))

      get '/api/v1/kollection/apps', headers: headers_for(admin)

      expect(response.parsed_body.first).to include('can_manage' => true, 'client_secret' => be_present)
    end
  end

  describe 'GET /api/v1/kollection/apps/:id' do
    it 'hides a pulled app from members, not from its keeper' do
      app = add_app(user.account)
      app.pull!

      get "/api/v1/kollection/apps/#{app.id}", headers: headers_for(Fabricate(:user))
      expect(response).to have_http_status(404)

      get "/api/v1/kollection/apps/#{app.id}", headers: headers
      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('status' => 'pulled')
    end
  end

  describe 'PATCH and DELETE' do
    it 'are for the keeper and admins' do
      app = add_app(Fabricate(:account))

      patch "/api/v1/kollection/apps/#{app.id}", headers: headers, params: { name: 'Mine now' }
      expect(response).to have_http_status(403)

      delete "/api/v1/kollection/apps/#{app.id}", headers: headers
      expect(response).to have_http_status(403)

      admin_headers = headers_for(Fabricate(:admin_user))
      patch "/api/v1/kollection/apps/#{app.id}", headers: admin_headers, params: { name: 'Renamed', redirect_uris: 'https://new.example/cb' }
      expect(response).to have_http_status(200)
      expect(app.reload.oauth_application).to have_attributes(name: 'Renamed', redirect_uri: 'https://new.example/cb')
    end

    it 'removes the app and its tokens' do
      app = add_app(user.account)
      token = connect(Fabricate(:user), app)

      delete "/api/v1/kollection/apps/#{app.id}", headers: headers

      expect(response).to have_http_status(200)
      expect(KollectionApp.exists?(app.id)).to be false
      expect(Doorkeeper::Application.exists?(app.oauth_application_id)).to be false
      expect(Doorkeeper::AccessToken.exists?(token.id)).to be false
    end
  end

  describe 'POST /api/v1/kollection/apps/:id/disconnect' do
    it "revokes the current member's tokens and no one else's" do
      app = add_app(Fabricate(:account))
      mine = connect(user, app)
      theirs = connect(Fabricate(:user), app)

      post "/api/v1/kollection/apps/#{app.id}/disconnect", headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('connected' => false)
      expect(mine.reload.revoked_at).to be_present
      expect(theirs.reload.revoked_at).to be_nil
    end
  end

  describe 'when the keeper goes' do
    it 'keeps the app, with no keeper' do
      keeper_user = Fabricate(:user)
      app = add_app(keeper_user.account)

      keeper_user.account.suspend!
      get "/api/v1/kollection/apps/#{app.id}", headers: headers
      expect(response.parsed_body).to include('keeper' => nil)

      keeper_user.destroy!
      keeper_user.account.destroy!

      expect(app.reload).to have_attributes(keeper_id: nil, oauth_application: be_present)
      get "/api/v1/kollection/apps/#{app.id}", headers: headers
      expect(response).to have_http_status(200)
    end
  end

  describe 'YOU, folded in' do
    it 'sends /hub/you to Kollection' do
      get '/hub/you'
      expect(response).to redirect_to('/hub/kollection')
      expect(response).to have_http_status(301)

      get '/hub/you/anything'
      expect(response).to redirect_to('/hub/kollection')
    end
  end
end
