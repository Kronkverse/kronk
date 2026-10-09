# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Actioning and closing a proposal' do
  let(:dev_user)      { Fabricate(:user) }
  let(:proposer_user) { Fabricate(:user) }
  let(:dev_headers)      { auth_headers(dev_user) }
  let(:proposer_headers) { auth_headers(proposer_user) }
  let(:proposal) do
    Proposal.create!(title: 'Build the thing', body: 'It would help.', created_by_account_id: proposer_user.account.id)
  end

  def auth_headers(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  describe 'POST /api/v1/proposals/:id/action' do
    it 'lets the claimant mark it actioned' do
      Kronk::ProposalStates.claim!(proposal, by: dev_user.account)

      post "/api/v1/proposals/#{proposal.id}/action", headers: dev_headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('status' => 'actioned')
    end

    it 'forbids someone who did not claim it' do
      Kronk::ProposalStates.claim!(proposal, by: Fabricate(:account))

      post "/api/v1/proposals/#{proposal.id}/action", headers: dev_headers
      expect(response).to have_http_status(403)
    end

    it 'forbids the proposer actioning their own claimed proposal' do
      Kronk::ProposalStates.claim!(proposal, by: proposer_user.account)

      post "/api/v1/proposals/#{proposal.id}/action", headers: proposer_headers

      expect(response).to have_http_status(403)
      expect(proposal.reload.status).to eq('claimed')
    end

    it 'refuses an unclaimed proposal' do
      post "/api/v1/proposals/#{proposal.id}/action", headers: dev_headers
      expect(response).to have_http_status(422)
    end
  end

  describe 'POST /api/v1/proposals/:id/close' do
    before { proposal.update!(status: :actioned) }

    it 'closes it for the proposer and keeps their outcome notes' do
      post "/api/v1/proposals/#{proposal.id}/close", params: { outcome_notes: 'Works a treat' }, headers: proposer_headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('status' => 'closed', 'outcome_notes' => 'Works a treat')
    end

    it 'forbids anyone else' do
      post "/api/v1/proposals/#{proposal.id}/close", headers: dev_headers
      expect(response).to have_http_status(403)
    end

    # Clients cached from before the rename still post to /complete.
    it 'is still reachable at the pre-rename /complete' do
      post "/api/v1/proposals/#{proposal.id}/complete", headers: proposer_headers

      expect(response).to have_http_status(200)
      expect(proposal.reload.status).to eq('closed')
    end
  end

  describe 'GET /api/v1/proposals filters' do
    it 'accepts the pre-rename filter names' do
      proposal.update!(status: :actioned)

      get '/api/v1/proposals', params: { filter: 'delivered' }, headers: dev_headers

      expect(response.parsed_body.pluck('id')).to include(proposal.id.to_s)
    end
  end

  describe 'GET /api/v1/token_balance' do
    # Stakes stay locked until the proposal closes or is annulled, whatever
    # live state it is in — including claimed.
    it 'counts a stake on a claimed proposal as staked' do
      TokenBalance.for(dev_user.account).update!(balance: 10)
      Kronk::Tokens.back!(dev_user.account, proposal, 4)
      Kronk::ProposalStates.claim!(proposal, by: Fabricate(:account))

      get '/api/v1/token_balance', headers: dev_headers

      expect(response.parsed_body).to include('available' => 6, 'staked' => 4, 'total' => 10)
    end
  end
end
