# frozen_string_literal: true

require 'rails_helper'

# Kommons is opt-in by tuning (2026-10-11): new accounts start tuned out, and
# Kronk::TuneInGate keeps a tuned-out korner's cards out of the feed. The
# proposal's Status itself stays reachable, as its discussion thread.
RSpec.describe 'Kommons proposals and tuning', :inline_jobs do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:bob)     { Fabricate(:account) }

  let!(:proposal_status) { PostStatusService.new.call(bob, text: 'Save images', post_type: :proposal) }
  let!(:ordinary_status) { PostStatusService.new.call(bob, text: 'Just a post') }

  around do |example|
    Kronk::FeatureFlags.with_flag(tune_in_enforced: true) { example.run }
  end

  before do
    Kronk::KornerRegistry.reload!
    user.account.follow!(bob)
    FeedManager.instance.populate_home(user.account)
  end

  def ids(path, params = {})
    get path, headers: headers, params: params
    expect(response).to have_http_status(200)
    response.parsed_body.pluck(:id)
  end

  it 'leaves proposals out of Home and Kommunity for a new account' do
    expect(ids('/api/v1/timelines/home')).to include(ordinary_status.id.to_s)
    expect(ids('/api/v1/timelines/home')).to_not include(proposal_status.id.to_s)
    expect(ids('/api/v1/timelines/public', local: true)).to_not include(proposal_status.id.to_s)
  end

  it 'shows proposals once the account tunes in to Kommons' do
    user.account.tune_in!(:kommons)

    expect(ids('/api/v1/timelines/home')).to include(proposal_status.id.to_s)
    expect(ids('/api/v1/timelines/public', local: true)).to include(proposal_status.id.to_s)
  end

  it 'keeps the proposal Status itself reachable' do
    get "/api/v1/statuses/#{proposal_status.id}", headers: headers
    expect(response).to have_http_status(200)
  end
end
