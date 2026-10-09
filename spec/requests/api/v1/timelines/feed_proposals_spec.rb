# frozen_string_literal: true

require 'rails_helper'

# Kommons proposals are opt-in in the feed (Kronk::FeedProposals): the feed
# timelines leave out `post_type: proposal` unless the viewer turned on
# kronk.feed_show_proposals. The proposal's Status itself stays reachable.
RSpec.describe 'Kommons proposals in the feed', :inline_jobs do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:bob)     { Fabricate(:account) }

  let!(:proposal_status) { PostStatusService.new.call(bob, text: 'Save images', post_type: :proposal) }
  let!(:ordinary_status) { PostStatusService.new.call(bob, text: 'Just a post') }
  let!(:own_proposal)    { PostStatusService.new.call(user.account, text: 'My own proposal', post_type: :proposal) }

  before do
    user.account.follow!(bob)
    FeedManager.instance.populate_home(user.account)
  end

  def opt_in!
    user.settings['kronk.feed_show_proposals'] = true
    user.save!
  end

  def home_ids(params = {})
    get '/api/v1/timelines/home', headers: headers, params: params
    expect(response).to have_http_status(200)
    response.parsed_body.pluck(:id)
  end

  def kommunity_ids
    get '/api/v1/timelines/public', headers: headers, params: { local: true }
    expect(response).to have_http_status(200)
    response.parsed_body.pluck(:id)
  end

  context 'with the default setting' do
    it 'leaves proposals out of Home, at Orbit and Me, and Kommunity' do
      expect(home_ids).to include(ordinary_status.id.to_s)
      expect(home_ids).to_not include(proposal_status.id.to_s, own_proposal.id.to_s)
      expect(home_ids(scope: 'me')).to_not include(own_proposal.id.to_s)

      expect(kommunity_ids).to include(ordinary_status.id.to_s)
      expect(kommunity_ids).to_not include(proposal_status.id.to_s, own_proposal.id.to_s)
    end

    it 'leaves out a boost of a proposal too' do
      boost = ReblogService.new.call(bob, own_proposal)

      expect(home_ids).to_not include(boost.id.to_s)
    end

    it 'keeps the proposal Status itself reachable, as the discussion thread' do
      get "/api/v1/statuses/#{proposal_status.id}", headers: headers
      expect(response).to have_http_status(200)

      get "/api/v1/statuses/#{proposal_status.id}/context", headers: headers
      expect(response).to have_http_status(200)
    end

    it 'leaves proposals out of Kommunity for signed-out visitors' do
      Setting.local_live_feed_access = 'public'
      get '/api/v1/timelines/public', params: { local: true }

      expect(response).to have_http_status(200)

      expect(response.parsed_body.pluck(:id)).to_not include(proposal_status.id.to_s)
    end
  end

  context 'when opted in' do
    before { opt_in! }

    it 'shows proposals in Home and Kommunity' do
      expect(home_ids).to include(proposal_status.id.to_s, ordinary_status.id.to_s)
      expect(kommunity_ids).to include(proposal_status.id.to_s)
    end
  end

  describe 'the Feed settings toggle' do
    it 'defaults off and can be turned on' do
      get '/api/v1/settings/feed', headers: headers
      expect(response.parsed_body.dig('values', 'show_proposals')).to be false

      put '/api/v1/settings/feed', headers: headers, params: { show_proposals: true }
      expect(response.parsed_body.dig('values', 'show_proposals')).to be true
      expect(user.reload.settings['kronk.feed_show_proposals']).to be true

      expect(home_ids).to include(proposal_status.id.to_s)
    end
  end
end
