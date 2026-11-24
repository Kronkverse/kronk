# frozen_string_literal: true

require 'rails_helper'

# An app added in Kollection signs people in with Kronk exactly like one
# made at /settings/applications (docs/spaces/kollection.md): authorization
# code with PKCE (S256), a confidential client, an ID token and userinfo.
RSpec.describe 'Sign in with Kronk for a Kollection app' do
  let(:redirect_uri) { 'https://pod.anthemos.example/signup/callback' }
  let(:user) { Fabricate(:user, account: Fabricate(:account, username: 'bob')) }
  let(:listing) do
    keeper = Fabricate(:account)
    Kollection::SaveApp.new(KollectionApp.new(keeper: keeper), actor: keeper, params: { name: 'Anthemos', sign_in: true, redirect_uris: "anthemos://kronk\n#{redirect_uri}", scopes: %w(openid profile) }).call
  end
  let(:client) { listing.oauth_application }
  let(:verifier) { SecureRandom.urlsafe_base64(48) }
  let(:challenge) { Base64.urlsafe_encode64(Digest::SHA256.digest(verifier), padding: false) }

  before { sign_in user }

  def authorize_params
    { client_id: client.uid, redirect_uri: redirect_uri, response_type: 'code', scope: 'openid profile', state: 'xyz',
      code_challenge: challenge, code_challenge_method: 'S256' }
  end

  def consent_form_fields(html)
    form = Nokogiri::HTML(html).css('form[action="/oauth/authorize"]').find { |f| f.at_css('input[name="_method"]').nil? }
    form.css('input[type="hidden"]').to_h { |input| [input['name'], input['value']] }.except('authenticity_token')
  end

  it 'signs a member in, and refuses once the app is pulled' do
    get '/oauth/authorize', params: authorize_params
    expect(response).to have_http_status(200)

    post '/oauth/authorize', params: consent_form_fields(response.body)
    expect(response).to redirect_to(start_with(redirect_uri))
    code = Rack::Utils.parse_query(URI.parse(response.location).query)['code']

    post '/oauth/token', params: { grant_type: 'authorization_code', code: code, redirect_uri: redirect_uri,
                                   client_id: client.uid, client_secret: client.secret, code_verifier: verifier }
    expect(response).to have_http_status(200)
    tokens = response.parsed_body
    expect(tokens['id_token']).to be_present

    get '/oauth/userinfo', headers: { 'Authorization' => "Bearer #{tokens['access_token']}" }
    expect(response).to have_http_status(200)
    expect(response.parsed_body).to include('preferred_username' => 'bob')
    expect(listing.connected?(user)).to be true

    listing.pull!

    get '/oauth/userinfo', headers: { 'Authorization' => "Bearer #{tokens['access_token']}" }
    expect(response).to have_http_status(401)

    get '/oauth/authorize', params: authorize_params
    expect(response.body).to_not include('form action="/oauth/authorize"')
    expect(response).to_not redirect_to(start_with(redirect_uri))
  end
end
