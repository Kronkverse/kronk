# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Claiming a proposal' do
  let(:dev)      { Fabricate(:user) }
  let(:token)    { Fabricate(:accessible_access_token, resource_owner_id: dev.id, scopes: 'read write') }
  let(:headers)  { { 'Authorization' => "Bearer #{token.token}" } }
  let(:proposer) { Fabricate(:account) }
  let(:proposal) do
    Proposal.create!(title: 'Build the thing', body: 'It would help.', created_by_account_id: proposer.id)
  end

  describe 'POST /api/v1/proposals/:id/claim' do
    it 'requires a signed-in user' do
      post "/api/v1/proposals/#{proposal.id}/claim"
      expect(response.status).to be_in([401, 422])
    end

    it 'claims the proposal and returns the claimant' do
      post "/api/v1/proposals/#{proposal.id}/claim", headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('status' => 'claimed')
      expect(response.parsed_body.dig('claimed_by_account', 'id')).to eq(dev.account.id.to_s)
    end

    it 'refuses a proposal someone else has already claimed' do
      Kronk::ProposalStates.claim!(proposal, by: Fabricate(:account))

      post "/api/v1/proposals/#{proposal.id}/claim", headers: headers
      expect(response).to have_http_status(422)
    end
  end

  describe 'POST /api/v1/proposals/:id/unclaim' do
    it 'lets the claimant hand it back' do
      Kronk::ProposalStates.claim!(proposal, by: dev.account)

      post "/api/v1/proposals/#{proposal.id}/unclaim", headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('status' => 'open', 'claimed_by_account' => nil)
    end

    it 'forbids anyone else' do
      Kronk::ProposalStates.claim!(proposal, by: Fabricate(:account))

      post "/api/v1/proposals/#{proposal.id}/unclaim", headers: headers
      expect(response).to have_http_status(403)
    end
  end

  describe 'GET /api/v1/proposals' do
    it 'keeps claimed proposals on the default board' do
      Kronk::ProposalStates.claim!(proposal, by: Fabricate(:account))

      get '/api/v1/proposals', headers: headers

      expect(response.parsed_body.pluck('id')).to include(proposal.id.to_s)
    end

    it 'lists only claimed proposals under filter=claimed' do
      unclaimed = Proposal.create!(title: 'Nobody on this', body: 'x', created_by_account_id: proposer.id)
      Kronk::ProposalStates.claim!(proposal, by: Fabricate(:account))

      get '/api/v1/proposals', params: { filter: 'claimed' }, headers: headers

      ids = response.parsed_body.pluck('id')
      expect(ids).to include(proposal.id.to_s)
      expect(ids).to_not include(unclaimed.id.to_s)
    end
  end
end
