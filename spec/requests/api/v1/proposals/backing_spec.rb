# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'POST /api/v1/proposals/:id/back' do
  let(:backer)   { Fabricate(:user) }
  let(:token)    { Fabricate(:accessible_access_token, resource_owner_id: backer.id, scopes: 'write') }
  let(:headers)  { { 'Authorization' => "Bearer #{token.token}" } }
  let(:proposer) { Fabricate(:account) }
  let(:proposal) do
    Proposal.create!(title: 'Build the thing', body: 'It would help.', created_by_account_id: proposer.id)
  end

  before { TokenBalance.for(backer.account).update!(balance: 10) }

  it 'requires a signed-in user' do
    post "/api/v1/proposals/#{proposal.id}/back", params: { amount: 3 }
    expect(response.status).to be_in([401, 422])
  end

  it 'stakes tokens, records the backing, and reflects it in the serializer' do
    expect do
      post "/api/v1/proposals/#{proposal.id}/back", params: { amount: 3 }, headers: headers
    end.to change { ProposalBacking.total_for(proposal.id) }.from(0).to(3)

    expect(response).to have_http_status(200)
    expect(response.parsed_body['backing']).to include('total' => 3, 'backers' => 1, 'my_stake' => 3, 'my_balance' => 7)
    expect(TokenBalance.for(backer.account).balance).to eq(7)
  end

  it 'accumulates a top-up as a second backing' do
    post "/api/v1/proposals/#{proposal.id}/back", params: { amount: 2 }, headers: headers
    post "/api/v1/proposals/#{proposal.id}/back", params: { amount: 4 }, headers: headers

    expect(response.parsed_body['backing']).to include('total' => 6, 'backers' => 1, 'my_stake' => 6)
    expect(ProposalBacking.where(proposal_id: proposal.id).count).to eq(2)
  end

  it 'rejects backing more than the balance' do
    post "/api/v1/proposals/#{proposal.id}/back", params: { amount: 99 }, headers: headers
    expect(response).to have_http_status(422)
    expect(TokenBalance.for(backer.account).balance).to eq(10)
  end

  it 'rejects a non-positive amount' do
    post "/api/v1/proposals/#{proposal.id}/back", params: { amount: 0 }, headers: headers
    expect(response).to have_http_status(422)
  end

  it 'rejects backing a proposal whose backing has closed' do
    proposal.update!(status: :delivered)
    post "/api/v1/proposals/#{proposal.id}/back", params: { amount: 3 }, headers: headers
    expect(response).to have_http_status(422)
    expect(ProposalBacking.total_for(proposal.id)).to eq(0)
  end
end
