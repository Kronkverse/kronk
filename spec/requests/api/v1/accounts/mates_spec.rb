# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'API V1 Accounts Mates' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:scopes)  { 'read:accounts' }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:account) { Fabricate(:account) }
  # alice is a Mate: she follows account and account follows her back.
  let(:alice)   { Fabricate(:account) }
  # bob follows account but is not followed back — a follower, not a Mate.
  let(:bob)     { Fabricate(:account) }
  # carol is followed by account but does not follow back — the other
  # one-way case, which the followers list would never have returned but
  # a naive mutual query could.
  let(:carol)   { Fabricate(:account) }
  # The viewer. Only the account itself and its Mates may see the list
  # (Tal, 2026-10-26), so the default viewer is a Mate of account.
  let(:viewer)  { user.account }

  before do
    alice.follow!(account)
    account.follow!(alice)
    bob.follow!(account)
    account.follow!(carol)
  end

  describe 'GET /api/v1/accounts/:account_id/mates' do
    before do
      next if viewer == account

      viewer.follow!(account)
      account.follow!(viewer)
    end

    it 'returns only mutual follows to a Mate', :aggregate_failures do
      get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }, headers: headers

      expect(response).to have_http_status(200)
      expect(response.content_type)
        .to start_with('application/json')
      expect(response.parsed_body)
        .to contain_exactly(hash_including(id: alice.id.to_s), hash_including(id: viewer.id.to_s))
    end

    context 'when the viewer is the account itself' do
      let(:user) { account.user }

      it 'returns their own mates' do
        get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }, headers: headers

        expect(response.parsed_body)
          .to contain_exactly(hash_including(id: alice.id.to_s))
      end
    end

    context 'when the viewer follows the account but is not followed back' do
      before { account.unfollow!(viewer) }

      it 'hides results' do
        get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }, headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body).to eq []
      end
    end

    context 'when the viewer has no connection to the account' do
      before do
        account.unfollow!(viewer)
        viewer.unfollow!(account)
      end

      it 'hides results' do
        get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }, headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body).to eq []
      end
    end

    context 'when the profile is shown to its owner only' do
      before { account.update(profile_visibility: :self_only) }

      it 'hides results from a Mate' do
        get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }, headers: headers

        expect(response.parsed_body).to eq []
      end
    end

    context 'when signed out' do
      it 'hides results' do
        get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }

        expect(response).to have_http_status(200)
        expect(response.parsed_body).to eq []
      end
    end

    it 'does not return blocked users' do
      user.account.block!(alice)
      get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }, headers: headers

      # The viewer is a Mate too, so they still see themselves.
      expect(response.parsed_body)
        .to contain_exactly(hash_including(id: viewer.id.to_s))
    end

    context 'when the requesting user is blocked' do
      before { account.block!(user.account) }

      it 'hides results' do
        get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }, headers: headers

        expect(response.parsed_body.size).to eq 0
      end
    end

    context 'when the account hides its collections' do
      before { account.update(hide_collections: true) }

      it 'hides results from a Mate' do
        get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }, headers: headers

        expect(response.parsed_body.size).to eq 0
      end

      context 'when the requesting user is the account owner' do
        let(:user) { account.user }

        it 'still returns their own mates' do
          get "/api/v1/accounts/#{account.id}/mates", params: { limit: 5 }, headers: headers

          expect(response.parsed_body)
            .to contain_exactly(hash_including(id: alice.id.to_s))
        end
      end
    end

    context 'with more mates than fit on a page' do
      let(:mates) { Fabricate.times(3, :account) }

      before do
        mates.each do |mate|
          mate.follow!(account)
          account.follow!(mate)
        end
      end

      it 'paginates with a next link' do
        get "/api/v1/accounts/#{account.id}/mates", params: { limit: 2 }, headers: headers

        expect(response).to have_http_status(200)
        expect(response.parsed_body.size).to eq 2
        expect(response.headers['Link'].to_s).to include('max_id')
      end
    end
  end
end
