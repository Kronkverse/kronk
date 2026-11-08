# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Withdrawing a proposal' do
  let(:proposer_user) { Fabricate(:user) }
  let(:other_user)    { Fabricate(:user) }
  let(:proposal) do
    Proposal.create!(title: 'Build the thing', body: 'It would help.', created_by_account_id: proposer_user.account.id)
  end

  def auth_headers(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def withdraw(as:)
    post "/api/v1/proposals/#{proposal.id}/withdraw", headers: auth_headers(as)
  end

  it 'lets the proposer withdraw an open proposal' do
    withdraw(as: proposer_user)

    expect(response).to have_http_status(200)
    expect(response.parsed_body).to include('status' => 'annulled')
    expect(proposal.reload.status).to eq('annulled')
  end

  it 'lets the proposer withdraw one they claimed themselves' do
    Kronk::ProposalStates.claim!(proposal, by: proposer_user.account)

    withdraw(as: proposer_user)

    expect(response).to have_http_status(200)
    expect(proposal.reload.status).to eq('annulled')
  end

  it 'refuses while someone else has claimed it' do
    Kronk::ProposalStates.claim!(proposal, by: other_user.account)

    withdraw(as: proposer_user)

    expect(response).to have_http_status(422)
    expect(proposal.reload.status).to eq('claimed')
  end

  it 'refuses while someone has joined the proposer on it' do
    Kronk::ProposalStates.claim!(proposal, by: proposer_user.account)
    Kronk::ProposalStates.join!(proposal, by: other_user.account)

    withdraw(as: proposer_user)

    expect(response).to have_http_status(422)
  end

  it 'refuses once it is actioned' do
    proposal.update!(status: :actioned)

    withdraw(as: proposer_user)

    expect(response).to have_http_status(422)
  end

  it 'forbids anyone but the proposer' do
    withdraw(as: other_user)

    expect(response).to have_http_status(403)
    expect(proposal.reload.status).to eq('open')
  end
end
