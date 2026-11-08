# frozen_string_literal: true

require 'rails_helper'

# docs/decisions.md, 2026-11-08, "Posts: no … menu; Repost is back": anyone
# who can see a post can repost it (a quote post), and the repost reaches
# only people who could already see the original.
RSpec.describe 'Reposts' do
  let(:ana)  { Fabricate(:user).account }
  let(:bob)  { Fabricate(:user).account }
  let(:cat)  { Fabricate(:user).account }

  def headers_for(account)
    token = Fabricate(:accessible_access_token, resource_owner_id: account.user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def make_mates(one, two)
    one.follow!(two)
    two.follow!(one)
  end

  def repost(as:, of:, **params)
    post '/api/v1/statuses', headers: headers_for(as), params: { status: 'Worth a look', quoted_status_id: of.id, **params }
    response.parsed_body
  end

  def can_open?(viewer, status_id)
    get "/api/v1/statuses/#{status_id}", headers: headers_for(viewer)
    response.status == 200
  end

  it 'lets anyone who can see a public post repost it, and shows it embedded' do
    original = PostStatusService.new.call(ana, text: 'Spring doof', visibility: 'public')

    body = repost(as: bob, of: original, visibility: 'public')

    expect(response).to have_http_status(200)
    expect(body.dig('quote', 'state')).to eq 'accepted'
    expect(body.dig('quote', 'quoted_status', 'id')).to eq original.id.to_s
    expect(can_open?(cat, body['id'])).to be true
  end

  it 'tells a viewer they can repost what they can see' do
    original = PostStatusService.new.call(ana, text: 'Spring doof', visibility: 'public')

    get "/api/v1/statuses/#{original.id}", headers: headers_for(bob)

    expect(response.parsed_body.dig('quote_approval', 'current_user')).to eq 'automatic'
  end

  it 'keeps a Krew-only post Krew-only inside a repost' do
    krew = Krew.create!(slug: 'growers', name: 'Growers', access: 'open')
    krew.krew_memberships.create!(account: ana)
    krew.krew_memberships.create!(account: bob)
    original = PostStatusService.new.call(ana, text: 'Seed swap', visibility: 'self_only', krew_ids: [krew.id])

    body = repost(as: bob, of: original, visibility: 'public')

    expect(response).to have_http_status(200)
    repost_status = Status.find(body['id'])
    expect(repost_status.visibility).to eq 'self_only'
    expect(repost_status.krews).to contain_exactly(krew)
    expect(can_open?(cat, repost_status.id)).to be false
  end

  it 'hides a repost of a Mates post from a Mate of the reposter who is not a Mate of the author' do
    make_mates(ana, bob)
    make_mates(bob, cat)
    original = PostStatusService.new.call(ana, text: 'Our place', visibility: 'mates')

    body = repost(as: bob, of: original, visibility: 'public')
    repost_status = Status.find(body['id'])

    expect(repost_status.visibility).to eq 'mates'
    expect(can_open?(cat, repost_status.id)).to be false

    cat.user.update!(current_sign_in_at: Time.now.utc)
    expect(FeedManager.instance.push_to_home(cat, repost_status)).to be false
    expect(FeedManager.instance.push_to_home(ana, repost_status)).to be true
  end

  it 'refuses a repost of a post the reposter cannot see' do
    original = PostStatusService.new.call(ana, text: 'Just us', visibility: 'mates')

    get "/api/v1/statuses/#{original.id}", headers: headers_for(cat)

    expect(response).to have_http_status(404)
  end
end
