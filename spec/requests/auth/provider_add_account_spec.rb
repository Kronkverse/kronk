# frozen_string_literal: true

require 'rails_helper'

# "Add account" through a sign-in provider (shadow's Kronk button). The
# account that comes back must join the switcher next to the current one,
# never be linked to it.
RSpec.describe 'Adding an account with a sign-in provider', if: Rails.configuration.x.omniauth.oidc_enabled? do
  let(:password) { 'ITySFcpG7yqPrDQ8sw' }
  let(:user_a)   { Fabricate(:user, email: 'a@example.com', password: password, confirmed_at: Time.now.utc, approved: true) }
  let(:user_b)   { Fabricate(:user, email: 'b@example.com', password: password, confirmed_at: Time.now.utc, approved: true) }

  before do
    Identity.create!(user: user_b, provider: 'openid_connect', uid: 'second')
    mock_omniauth(:openid_connect, { provider: 'openid_connect', uid: 'second', info: { nickname: 'second' } })
    post user_session_path, params: { user: { email: user_a.email, password: password } }
  end

  def roster
    get '/auth/accounts', headers: { 'Accept' => 'application/json' }
    response.parsed_body
  end

  it 'carries the add intent on the provider button' do
    get new_user_session_path(add: 1)

    expect(response.parsed_body.at_css(".alternative-login form[action='#{user_openid_connect_omniauth_authorize_path(add: 1)}']")).to be_present
  end

  it 'signs the returning account in alongside the current one' do
    post user_openid_connect_omniauth_authorize_path(add: 1)
    follow_redirect!

    expect(Identity.find_by(provider: 'openid_connect', uid: 'second').user).to eq user_b
    expect(Identity.where(user: user_a)).to be_empty
    expect(roster.pluck('id')).to contain_exactly(user_a.id.to_s, user_b.id.to_s)
    expect(roster.find { |a| a['id'] == user_b.id.to_s }['active']).to be(true)
  end
end
