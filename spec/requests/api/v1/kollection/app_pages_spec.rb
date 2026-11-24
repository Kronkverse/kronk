# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/kollection.md, An app's page; decisions.md 2026-11-24.
RSpec.describe 'Kollection app pages' do
  let(:user)    { Fabricate(:user) }
  let(:headers) { headers_for(user) }

  def headers_for(someone)
    token = Fabricate(:accessible_access_token, resource_owner_id: someone.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def add_app(keeper, name = 'Anthemos', **params)
    Kollection::SaveApp.new(KollectionApp.new(keeper: keeper), actor: keeper, params: { name: name, sign_in: true, redirect_uris: 'https://anthemos.example/cb' }.merge(params)).call
  end

  def mates!(one, other)
    one.account.follow!(other.account)
    other.account.follow!(one.account)
  end

  def connect(someone, app)
    Fabricate(:access_token, application: app.oauth_application, resource_owner_id: someone.id, scopes: 'openid profile')
  end

  describe 'reached by name' do
    it 'names the page after the app, keeps old names after a rename, and still takes the number' do
      app = add_app(user.account, 'Anthemos')
      expect(app.slug).to eq 'anthemos'

      get '/api/v1/kollection/apps/anthemos', headers: headers
      expect(response.parsed_body).to include('id' => app.id.to_s, 'slug' => 'anthemos')

      patch "/api/v1/kollection/apps/#{app.id}", headers: headers, params: { name: 'Anthemos Home' }
      expect(response.parsed_body['slug']).to eq 'anthemos-home'

      get '/api/v1/kollection/apps/anthemos', headers: headers
      expect(response).to have_http_status(200)
      expect(response.parsed_body['slug']).to eq 'anthemos-home'

      get "/api/v1/kollection/apps/#{app.id}", headers: headers
      expect(response.parsed_body['slug']).to eq 'anthemos-home'
    end

    it 'counts up for the same name and never takes a page of Kollection' do
      expect(add_app(user.account, 'Anthemos').slug).to eq 'anthemos'
      expect(add_app(user.account, 'Anthemos').slug).to eq 'anthemos-2'
      expect(add_app(user.account, 'Settings').slug).to eq 'settings-1'
    end

    it 'answers not found for a pulled app, by name or number, as for one that does not exist' do
      app = add_app(Fabricate(:account))
      app.pull!

      get "/api/v1/kollection/apps/#{app.slug}", headers: headers
      expect(response).to have_http_status(404)
      get "/api/v1/kollection/apps/#{app.id}", headers: headers
      expect(response).to have_http_status(404)
      get '/api/v1/kollection/apps/nothing-here', headers: headers
      expect(response).to have_http_status(404)
    end
  end

  describe 'the listing' do
    it 'takes a tagline, who made it, a category and platforms from the small fixed sets' do
      post '/api/v1/kollection/apps', headers: headers, params: {
        name: 'Anthemos', website: 'https://anthemos.example', tagline: 'Your phone, your pod.', made_by: 'Tal',
        category: 'tools', platforms: %w(android web beos)
      }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('tagline' => 'Your phone, your pod.', 'made_by' => 'Tal',
                                              'category' => 'tools', 'platforms' => %w(web android))

      post '/api/v1/kollection/apps', headers: headers, params: { name: 'Odd', website: 'https://odd.example', category: 'astrology' }
      expect(response).to have_http_status(422)
    end

    it 'takes where to get it for a phone, as a web address' do
      post '/api/v1/kollection/apps', headers: headers, params: {
        name: 'Anthemos', website: 'https://anthemos.example', download_url: ' https://anthemos.example/app.apk '
      }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('download_url' => 'https://anthemos.example/app.apk')

      post '/api/v1/kollection/apps', headers: headers, params: { name: 'Odd', website: 'https://odd.example', download_url: 'anthemos://open' }
      expect(response).to have_http_status(422)
    end

    it 'keeps up to six screenshots, in order, from your own uploads' do
      mine = Fabricate.times(7, :media_attachment, account: user.account, status: nil)
      theirs = Fabricate(:media_attachment, status: nil)
      app = add_app(user.account)

      patch "/api/v1/kollection/apps/#{app.id}", headers: headers, params: { screenshot_ids: mine.first(7).map(&:id) }
      expect(response).to have_http_status(422)
      expect(app.screenshots.reload).to be_empty

      ids = [mine[2].id, theirs.id, mine[0].id]
      patch "/api/v1/kollection/apps/#{app.id}", headers: headers, params: { screenshot_ids: ids }
      expect(response).to have_http_status(200)
      expect(response.parsed_body['screenshots'].pluck('id')).to eq [mine[2].id.to_s, mine[0].id.to_s]

      patch "/api/v1/kollection/apps/#{app.id}", headers: headers, params: { screenshot_ids: [mine[0].id] }
      expect(app.screenshots.reload.map(&:media_attachment_id)).to eq [mine[0].id]
    end
  end

  describe 'Mates using it' do
    let(:listing) { add_app(Fabricate(:account)) }
    let(:mate) { Fabricate(:user) }

    before do
      mates!(user, mate)
      connect(mate, listing)
    end

    it 'shows your Mates who use it' do
      get "/api/v1/kollection/apps/#{listing.slug}", headers: headers

      expect(response.parsed_body['mates_using'].pluck('id')).to eq [mate.account_id.to_s]
    end

    it 'shows nobody to someone who is not their Mate, nor anyone who only follows one way' do
      stranger = Fabricate(:user)
      follower = Fabricate(:user)
      follower.account.follow!(mate.account)

      [stranger, follower].each do |someone|
        get "/api/v1/kollection/apps/#{listing.slug}", headers: headers_for(someone)
        expect(response.parsed_body['mates_using']).to eq []
      end
    end

    it 'leaves out a Mate who turned off "Show my mates which apps I use"' do
      UserKornerSetting.create!(user: mate, korner_slug: 'kollection', values: { 'show_mates_apps' => false })

      get "/api/v1/kollection/apps/#{listing.slug}", headers: headers

      expect(response.parsed_body['mates_using']).to eq []
    end

    it 'sets the switch through the korner settings API' do
      patch '/api/v1/korners/kollection/settings/show_mates_apps', headers: headers_for(mate), params: { value: false }
      expect(response).to have_http_status(200)

      get "/api/v1/kollection/apps/#{listing.slug}", headers: headers
      expect(response.parsed_body['mates_using']).to eq []
    end

    it 'leaves out a Mate who disconnected' do
      listing.disconnect!(mate)

      get "/api/v1/kollection/apps/#{listing.slug}", headers: headers

      expect(response.parsed_body['mates_using']).to eq []
    end

    it 'is not in the list of apps, only on its page' do
      get '/api/v1/kollection/apps', headers: headers

      expect(response.parsed_body.first).to_not have_key('mates_using')
    end

    it 'is empty for a link, which Kronk cannot see anyone use' do
      link = KollectionApp.create!(name: 'YOU', website: 'https://you.example')

      get "/api/v1/kollection/apps/#{link.slug}", headers: headers

      expect(response.parsed_body['mates_using']).to eq []
    end
  end
end
