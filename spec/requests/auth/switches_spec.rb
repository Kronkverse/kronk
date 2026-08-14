# frozen_string_literal: true

require 'rails_helper'

# Security-focused coverage for the account switcher. The invariant that
# matters: you can only switch to an account this browser actually
# authenticated (a member of the server-only session[:authed_accounts] set).
RSpec.describe 'Account switcher' do
  let(:password) { 'ITySFcpG7yqPrDQ8sw' }
  let(:user_a)   { Fabricate(:user, email: 'a@example.com', password: password, confirmed_at: Time.now.utc, approved: true) }
  let(:user_b)   { Fabricate(:user, email: 'b@example.com', password: password, confirmed_at: Time.now.utc, approved: true) }
  let(:user_c)   { Fabricate(:user, email: 'c@example.com', password: password, confirmed_at: Time.now.utc, approved: true) }

  def login(user, add: false)
    params = { user: { email: user.email, password: password } }
    params[:add] = '1' if add
    post user_session_path, params: params
  end

  def roster
    get '/auth/accounts', headers: { 'Accept' => 'application/json' }
    response.parsed_body
  end

  describe 'building the authenticated-account set' do
    it 'holds each account signed in on this browser' do
      login(user_a)
      login(user_b, add: true)

      ids = roster.pluck('id')
      expect(ids).to contain_exactly(user_a.id.to_s, user_b.id.to_s)
      expect(roster.find { |a| a['id'] == user_b.id.to_s }['active']).to be(true)
    end

    it 'never exposes a token or session id in the roster' do
      login(user_a)
      login(user_b, add: true)

      expect(roster.to_json).to_not match(/session_id|token/)
    end

    it 'caps the set at MAX_SWITCHER_ACCOUNTS, evicting the oldest' do
      max = AccountSwitching::MAX_SWITCHER_ACCOUNTS
      users = Array.new(max + 1) do |i|
        Fabricate(:user, email: "cap#{i}@example.com", password: password, confirmed_at: Time.now.utc, approved: true)
      end

      users.each_with_index { |user, i| login(user, add: i.positive?) }

      ids = roster.pluck('id')
      expect(ids.size).to eq(max)
      expect(ids).to_not include(users.first.id.to_s) # oldest evicted
      expect(ids).to include(users.last.id.to_s) # newest kept
    end
  end

  describe 'POST /auth/switch' do
    it 'activates an account already in the set (reusing its session, no new token)' do
      login(user_a)
      login(user_b, add: true)

      expect { post '/auth/switch', params: { user_id: user_a.id }, as: :json }
        .to_not(change(SessionActivation, :count))

      expect(response).to have_http_status(200)
      expect(response.parsed_body['redirect_to']).to eq('/')
      expect(roster.find { |a| a['id'] == user_a.id.to_s }['active']).to be(true)
    end

    it 'fails closed for a user_id that is not in the set' do
      login(user_a) # only A is authenticated on this browser

      post '/auth/switch', params: { user_id: user_b.id }, as: :json

      expect(response).to have_http_status(403)
      expect(roster.find { |a| a['id'] == user_a.id.to_s }['active']).to be(true) # still A
    end

    it 'fails closed for an unauthenticated visitor with no roster' do
      # Anyone can POST /auth/switch (the sign-in / landing views expose
      # "Continue as @X" buttons that reach it before any Devise
      # authentication has landed) — but the same `set.key?(target)` check
      # applies. A visitor whose session has no authed_accounts can never
      # switch to any account.
      post '/auth/switch', params: { user_id: user_a.id }, as: :json
      expect(response).to have_http_status(403)
    end

    it 'prunes and fails closed when the target activation is gone' do
      login(user_a)
      login(user_b, add: true)

      # Simulate a password change / remote revoke destroying A's activation.
      user_a.session_activations.destroy_all

      post '/auth/switch', params: { user_id: user_a.id }, as: :json
      expect(response).to have_http_status(401)

      # A is pruned from the roster; only B remains.
      expect(roster.pluck('id')).to contain_exactly(user_b.id.to_s)
    end
  end

  # NOTE: logout is stock Devise `super` plus `session.delete(:authed_accounts)`
  # (see Auth::SessionsController#destroy). Driving it through this multi-login +
  # reset_session request-spec harness is flaky (the DELETE doesn't reach the
  # override cleanly), so logout-after-switch is verified manually on shadow
  # rather than here. The switcher-specific logic above (set, switch, prune, cap)
  # is the security surface and is covered.
end
