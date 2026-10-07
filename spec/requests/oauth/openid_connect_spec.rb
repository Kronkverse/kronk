# frozen_string_literal: true

require 'rails_helper'

# "Sign in with Kronk": Kronk as an OpenID Connect provider
# (config/initializers/doorkeeper_openid_connect.rb). These walk the flow a
# relying party (shadow, or any site a member builds) goes through.
RSpec.describe 'OpenID Connect' do
  let(:issuer) { "#{Rails.configuration.x.use_https ? 'https' : 'http'}://#{Rails.configuration.x.web_domain}" }
  let(:redirect_uri) { 'https://rp.example/callback' }
  let(:user) { Fabricate(:user, account: Fabricate(:account, username: 'bob', display_name: 'Bob B')) }
  let(:application) { Fabricate(:application, scopes: 'openid profile read', redirect_uri: redirect_uri) }

  describe 'GET /.well-known/openid-configuration' do
    it 'publishes the provider metadata' do
      get '/.well-known/openid-configuration'

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include(
        'issuer' => issuer,
        'jwks_uri' => end_with('/oauth/discovery/keys'),
        'userinfo_endpoint' => end_with('/oauth/userinfo'),
        'id_token_signing_alg_values_supported' => include('RS256'),
        'scopes_supported' => include('openid', 'profile')
      )
    end
  end

  describe 'GET /.well-known/oauth-authorization-server' do
    it "is still Mastodon's own metadata" do
      get '/.well-known/oauth-authorization-server'

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('app_registration_endpoint')
    end
  end

  describe 'GET /oauth/discovery/keys' do
    it 'publishes the public signing key' do
      get '/oauth/discovery/keys'

      expect(response).to have_http_status(200)
      expect(response.parsed_body['keys'].first).to include('kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig')
    end
  end

  describe 'the authorization code flow' do
    before { sign_in user }

    def authorize_and_exchange(scope:, nonce: nil)
      params = { client_id: application.uid, redirect_uri: redirect_uri, response_type: 'code', scope: scope, state: 'xyz', nonce: nonce }.compact

      get '/oauth/authorize', params: params
      expect(response).to have_http_status(200) # the consent screen

      # Submit what the consent screen's Authorize form actually carries,
      # not the original params: a field the form drops (the nonce, once)
      # must fail here rather than on a real sign-in.
      post '/oauth/authorize', params: consent_form_fields(response.body)
      expect(response).to redirect_to(start_with(redirect_uri))
      code = Rack::Utils.parse_query(URI.parse(response.location).query)['code']

      post '/oauth/token', params: {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirect_uri,
        client_id: application.uid,
        client_secret: application.secret,
      }
      expect(response).to have_http_status(200)
      response.parsed_body
    end

    def consent_form_fields(html)
      form = Nokogiri::HTML(html).css('form[action="/oauth/authorize"]').find { |f| f.at_css('input[name="_method"]').nil? }
      form.css('input[type="hidden"]').to_h { |input| [input['name'], input['value']] }.except('authenticity_token')
    end

    def decode_id_token(token)
      get '/oauth/discovery/keys'
      jwks = JWT::JWK::Set.new(response.parsed_body)
      JWT.decode(token, nil, true, algorithms: ['RS256'], jwks: jwks).first
    end

    it 'issues a signed ID token whose claims match /oauth/userinfo' do
      tokens = authorize_and_exchange(scope: 'openid profile', nonce: 'n-0S6_WzA2Mj')
      claims = decode_id_token(tokens['id_token'])

      expect(claims).to include(
        'iss' => issuer,
        'aud' => application.uid,
        'sub' => user.account_id.to_s,
        'nonce' => 'n-0S6_WzA2Mj',
        'preferred_username' => 'bob',
        'name' => 'Bob B'
      )
      expect(claims).to_not include('email')

      get '/oauth/userinfo', headers: { 'Authorization' => "Bearer #{tokens['access_token']}" }
      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('sub' => claims['sub'], 'preferred_username' => 'bob')
    end

    it 'shows the member what they are sharing on the consent screen' do
      get '/oauth/authorize', params: { client_id: application.uid, redirect_uri: redirect_uri, response_type: 'code', scope: 'openid profile' }

      expect(response.body)
        .to include(I18n.t('doorkeeper.grouped_scopes.title.openid'))
        .and include(I18n.t('doorkeeper.grouped_scopes.access.read'))
        .and include(I18n.t('doorkeeper.grouped_scopes.title.profile'))
      expect(response.body).to_not match(/translation missing|Read and write access/i)
    end

    it 'issues no ID token when the openid scope was not requested' do
      tokens = authorize_and_exchange(scope: 'read')

      expect(tokens).to_not have_key('id_token')
    end
  end
end
