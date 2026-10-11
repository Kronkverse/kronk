# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'A proposal carries its board-tile signals' do
  let(:user)      { Fabricate(:user) }
  let(:token)     { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers)   { { 'Authorization' => "Bearer #{token.token}" } }
  let(:proposer)  { Fabricate(:account) }
  let(:commenter) { Fabricate(:account, username: 'ashofearth') }
  let(:proposal)  { Proposal.create!(title: 'Save images', body: 'A whole gallery.', created_by_account_id: proposer.id) }

  it 'counts comments and serves the latest one' do
    ProposalComment.create!(proposal: proposal, account: proposer, body: 'First')
    ProposalComment.create!(proposal: proposal, account: commenter, body: 'I back this 100 ks')

    get "/api/v1/proposals/#{proposal.id}", headers: headers

    expect(response.parsed_body).to include(
      'comments_count' => 2,
      'latest_comment' => { 'username' => 'ashofearth', 'body' => 'I back this 100 ks' },
      'attachments_count' => 0
    )
  end

  it 'has no latest comment when nobody has commented' do
    get "/api/v1/proposals/#{proposal.id}", headers: headers

    expect(response.parsed_body).to include('comments_count' => 0, 'latest_comment' => nil)
  end
end
