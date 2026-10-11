# frozen_string_literal: true

require 'rails_helper'

# The Home read filters (proposals, suppressed post types, the reach tier)
# drop statuses after a page is read. A page they empty must not end the feed
# (Kronk::FilteredFeedPage), and Me reads the viewer's own posts, not just the
# ones still in the home feed's window.
RSpec.describe 'Home timeline pages through read-side filters', :inline_jobs do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:bob)     { Fabricate(:account) }

  before { user.account.follow!(bob) }

  def home(params = {})
    get '/api/v1/timelines/home', headers: headers, params: params
    expect(response).to have_http_status(200)
    response.parsed_body.pluck(:id)
  end

  context 'when a whole page is filtered out' do
    let!(:ordinary) { PostStatusService.new.call(bob, text: 'Older ordinary post') }

    before do
      3.times { |i| PostStatusService.new.call(bob, text: "Proposal #{i}", post_type: :proposal) }
      FeedManager.instance.populate_home(user.account)
    end

    it 'reads on until it finds posts' do
      expect(home(limit: 2)).to eq [ordinary.id.to_s]
    end

    it 'still links to the next page when the read budget runs out' do
      stub_const('Kronk::FilteredFeedPage::MAX_READS', 1)

      expect(home(limit: 2)).to be_empty
      expect(LinkHeader.parse(response.headers['Link']).find_link(%w(rel next))).to_not be_nil

      next_max_id = LinkHeader.parse(response.headers['Link']).find_link(%w(rel next)).href[/max_id=(\d+)/, 1]
      expect(home(limit: 2, max_id: next_max_id)).to eq [ordinary.id.to_s]
    end
  end

  context 'with the Me tier' do
    # Not fanned out, so not in the home feed — like a post older than its window.
    let!(:old_own) { Fabricate(:status, account: user.account, text: 'Long ago') }
    let!(:own)     { PostStatusService.new.call(user.account, text: 'Mine') }

    before do
      4.times { |i| PostStatusService.new.call(bob, text: "Bob #{i}") }
    end

    it 'shows every own post, past a page of other people' do
      Kronk::FeatureFlags.with_flag(feed_scope_enforced: true) do
        expect(home(scope: 'me', limit: 1)).to eq [own.id.to_s]

        next_max_id = LinkHeader.parse(response.headers['Link']).find_link(%w(rel next)).href[/max_id=(\d+)/, 1]
        expect(home(scope: 'me', limit: 1, max_id: next_max_id)).to eq [old_own.id.to_s]
      end
    end
  end
end
