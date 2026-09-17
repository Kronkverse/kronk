# frozen_string_literal: true

require 'rails_helper'

# The ceremony is the first thing every existing member meets at the 2.0
# cutover. There is no backfill migration — `thresholds_version` is NULL
# for every account that predates it — so on the first HTML request after
# the deploy, all of them are redirected here. That makes this the one
# path nobody can route around, and it had no coverage.
RSpec.describe 'The threshold ceremony' do
  # An account as it exists on the morning of the cutover: real, confirmed,
  # in use for years, and never having seen a threshold.
  let(:existing_member) do
    Fabricate(:user, thresholds_agreed_at: nil, thresholds_version: nil)
  end

  let(:vows) { Kronk::Thresholds::KEYS.index_with { '1' } }

  describe 'the gate' do
    before { sign_in existing_member }

    it 'sends an uncrossed member to the ceremony rather than the page they asked for' do
      get '/home'

      expect(response).to redirect_to(auth_thresholds_path)
    end

    it 'lets them reach the ceremony itself without looping' do
      get auth_thresholds_path

      expect(response).to have_http_status(200)
    end

    # The gate must not close over the API, or every signed-in client
    # breaks at the cutover rather than just the web UI.
    it 'does not gate the API' do
      get '/api/v1/instance'

      expect(response).to_not redirect_to(auth_thresholds_path)
    end
  end

  describe 'crossing' do
    before { sign_in existing_member }

    it 'records the crossing and lets them in' do
      post auth_thresholds_path, params: vows

      expect(response).to redirect_to(root_path)
      expect(existing_member.reload.crossed_thresholds?).to be true
      expect(existing_member.thresholds_agreed_at).to_not be_nil
    end

    it 'stops gating once crossed' do
      post auth_thresholds_path, params: vows
      get '/home'

      expect(response).to_not redirect_to(auth_thresholds_path)
    end

    it 'sends an already-crossed member away from the ceremony' do
      post auth_thresholds_path, params: vows
      get auth_thresholds_path

      expect(response).to redirect_to(root_path)
    end

    # Atomic by design: no partial credit, so a missing vow must leave the
    # member uncrossed rather than half-admitted.
    it 'refuses a partial crossing' do
      post auth_thresholds_path, params: vows.merge(trajectory: '0')

      expect(response).to redirect_to(auth_thresholds_path)
      expect(existing_member.reload.crossed_thresholds?).to be false
    end
  end

  # A vow-line change bumps CURRENT_VERSION and everyone re-crosses.
  describe 'when the vows have materially changed' do
    let(:previously_crossed) do
      Fabricate(:user, thresholds_agreed_at: 1.year.ago, thresholds_version: Kronk::Thresholds::CURRENT_VERSION - 1)
    end

    before { sign_in previously_crossed }

    it 'asks a member on an older version to cross again' do
      get '/home'

      expect(response).to redirect_to(auth_thresholds_path)
    end
  end
end
