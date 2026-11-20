# frozen_string_literal: true

require 'rails_helper'

# What you've chosen not to see from one Mate (the Mateship page;
# decisions.md, 2026-11-20) leaves the feed, and only that: their other
# posts, and the same kind of post from anyone else, still arrive.
RSpec.describe 'A Mate’s posts as the Mateship page says', :inline_jobs do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:viewer)  { user.account }
  let(:bob)     { Fabricate(:account) }
  let(:cleo)    { Fabricate(:account) }

  let!(:bob_proposal) { PostStatusService.new.call(bob, text: 'Save images', post_type: :proposal) }
  let!(:bob_post)     { PostStatusService.new.call(bob, text: 'Just a post') }
  let!(:cleo_proposal) { PostStatusService.new.call(cleo, text: 'Plant trees', post_type: :proposal) }

  before do
    Kronk::KornerRegistry.reload!
    [bob, cleo].each do |mate|
      viewer.follow!(mate)
      mate.follow!(viewer)
    end
    FeedManager.instance.populate_home(viewer)
  end

  def ids(path, params = {})
    get path, headers: headers, params: params
    expect(response).to have_http_status(200)
    response.parsed_body.pluck(:id)
  end

  it 'leaves out one Mate’s korner cards and nothing else', :aggregate_failures do
    MateTuneOut.create!(account: viewer, target_account: bob, korner_slug: 'kommons')

    home = ids('/api/v1/timelines/home')
    expect(home).to_not include(bob_proposal.id.to_s)
    expect(home).to include(bob_post.id.to_s, cleo_proposal.id.to_s)

    kommunity = ids('/api/v1/timelines/public', local: true)
    expect(kommunity).to_not include(bob_proposal.id.to_s)
    expect(kommunity).to include(bob_post.id.to_s, cleo_proposal.id.to_s)
  end

  it 'leaves out a Mate’s plain posts but keeps their korner cards', :aggregate_failures do
    MateTuneOut.create!(account: viewer, target_account: bob, korner_slug: 'posts')

    home = ids('/api/v1/timelines/home')
    expect(home).to_not include(bob_post.id.to_s)
    expect(home).to include(bob_proposal.id.to_s)
  end

  it 'forgets the choices when the Mate is removed' do
    MateTuneOut.create!(account: viewer, target_account: bob, korner_slug: 'posts')
    MateTuneOut.create!(account: bob, target_account: viewer, korner_slug: 'posts')

    Mates::UnmateService.new.call(viewer, bob)

    expect(MateTuneOut.count).to eq 0
  end
end
