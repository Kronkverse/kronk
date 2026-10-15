# frozen_string_literal: true

require 'rails_helper'

# The board works out every tile's numbers for the whole page at once
# (Kronk::ProposalBoardStats). It must say exactly what each proposal's own
# page says, and its queries must not grow with the number of proposals.
RSpec.describe 'The proposal board' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def make_proposal(index)
    proposal = Fabricate(:proposal, title: "Proposal #{index}")
    Task.create!(proposal: proposal, title: 'Task', status: index.even? ? :open : :done)
    ProposalComment.create!(proposal: proposal, account: Fabricate(:account), body: "First on #{index}")
    ProposalComment.create!(proposal: proposal, account: Fabricate(:account), body: "Latest on #{index}")
    Kronk::Tokens.grant!(user.account, 5)
    Kronk::Tokens.back!(user.account, proposal, 1 + (index % 3))
    proposal
  end

  def board
    get '/api/v1/proposals', headers: headers
    response.parsed_body.index_by { |p| p['id'] }
  end

  def queries_for_board
    count = 0
    counter = ->(*, payload) { count += 1 unless payload[:name] == 'SCHEMA' || payload[:cached] }
    ActiveSupport::Notifications.subscribed(counter, 'sql.active_record') { board }
    count
  end

  it "shows each tile the same numbers as the proposal's own page" do
    proposals = Array.new(3) { |i| make_proposal(i) }
    tiles = board
    keys = %w(task_summary comments_count latest_comment attachments_count backing)

    proposals.each do |proposal|
      get "/api/v1/proposals/#{proposal.id}", headers: headers
      expect(tiles[proposal.id.to_s].slice(*keys)).to eq(response.parsed_body.slice(*keys))
    end
  end

  it 'runs about the same number of queries for twice the proposals' do
    3.times { |i| make_proposal(i) }
    few = queries_for_board
    3.times { |i| make_proposal(i + 3) }
    many = queries_for_board

    expect(many).to be <= few + 3
  end
end
