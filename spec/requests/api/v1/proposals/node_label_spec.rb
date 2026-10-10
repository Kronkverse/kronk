# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'A proposal names its node' do
  let(:user)     { Fabricate(:user) }
  let(:token)    { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers)  { { 'Authorization' => "Bearer #{token.token}" } }
  let(:proposer) { Fabricate(:account) }

  it 'serves the node label alongside the node id' do
    proposal = Proposal.create!(title: 'Notifications', body: 'Split them out.', node_id: 'nudges.index', created_by_account_id: proposer.id)

    get "/api/v1/proposals/#{proposal.id}", headers: headers

    expect(response.parsed_body).to include('node_id' => 'nudges.index', 'node_label' => 'Nudges')
  end

  it 'has no label when the proposal has no node' do
    proposal = Proposal.create!(title: 'General', body: 'About everything.', created_by_account_id: proposer.id)

    get "/api/v1/proposals/#{proposal.id}", headers: headers

    expect(response.parsed_body['node_label']).to be_nil
  end
end
