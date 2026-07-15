# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'GET /api/v1/kommons/nodes' do
  let(:user) { Fabricate(:user) }
  let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  before do
    Kronk::NodeRegistry.reload!
    Kronk::KornerRegistry.reload!
  end

  it 'requires a signed-in user' do
    get '/api/v1/kommons/nodes'
    expect(response.status).to be_in([401, 422])
  end

  context 'when signed in' do
    it 'returns the full node registry' do
      get '/api/v1/kommons/nodes', headers: headers
      expect(response).to have_http_status(200)

      body = response.parsed_body
      ids = body['nodes'].pluck('id')

      # Cross-cutting nodes
      expect(ids).to include('feed.home', 'profile.view', 'settings.prefs')
      # Korner-declared nodes
      expect(ids).to include('kommons.index', 'booth.index', 'kalendar.index')
    end

    it 'includes bucket, label, url, lifecycle, spa, open_proposals per node' do
      get '/api/v1/kommons/nodes', headers: headers
      home = response.parsed_body['nodes'].find { |n| n['id'] == 'feed.home' }
      expect(home).to include(
        'bucket' => 'feed',
        'label' => 'Home timeline',
        'lifecycle' => 'live',
        'spa' => true,
        'open_proposals' => 0
      )
    end

    it 'joins per-node open proposal counts from the proposals table' do
      account = user.account
      Fabricate(:proposal, created_by_account: account, node_id: 'booth.index', status: :open)
      Fabricate(:proposal, created_by_account: account, node_id: 'booth.index', status: :open)
      Fabricate(:proposal, created_by_account: account, node_id: 'kalendar.index', status: :open)
      # Non-open proposal shouldn't be counted
      Fabricate(:proposal, created_by_account: account, node_id: 'booth.index', status: :delivered)

      get '/api/v1/kommons/nodes', headers: headers
      nodes = response.parsed_body['nodes'].index_by { |n| n['id'] }

      expect(nodes['booth.index']['open_proposals']).to eq(2)
      expect(nodes['kalendar.index']['open_proposals']).to eq(1)
      expect(nodes['kommons.index']['open_proposals']).to eq(0)
    end
  end

  describe 'POST /api/v1/proposals with node_id' do
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write') }

    it 'accepts a valid node_id' do
      post '/api/v1/proposals',
           params: { proposal: { title: 'Bug on booth', body: 'Player wobbles.', node_id: 'booth.index' } },
           headers: headers

      expect(response).to have_http_status(:success).or have_http_status(201)
      proposal = Proposal.find(response.parsed_body['id'])
      expect(proposal.node_id).to eq('booth.index')
    end

    it 'rejects an unregistered node_id' do
      post '/api/v1/proposals',
           params: { proposal: { title: 'x', body: 'y', node_id: 'not-a-node' } },
           headers: headers

      expect(response).to have_http_status(422)
    end

    it 'still accepts proposals without a node_id (classic structural proposals)' do
      post '/api/v1/proposals',
           params: { proposal: { title: 'Bump quorum', body: 'Because ...' } },
           headers: headers

      expect(response).to have_http_status(:success).or have_http_status(201)
      proposal = Proposal.find(response.parsed_body['id'])
      expect(proposal.node_id).to be_nil
    end
  end
end
