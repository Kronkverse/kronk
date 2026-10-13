# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/profile.md, Posts from Mates.
RSpec.describe 'Posts on a profile', :inline_jobs do
  let(:user)     { Fabricate(:user) }
  let(:me)       { user.account }
  let(:headers)  { headers_for(user) }
  let(:owner)    { Fabricate(:user, account_attributes: { username: 'ana' }) }
  let(:stranger) { Fabricate(:user) }

  def headers_for(who)
    token = Fabricate(:accessible_access_token, resource_owner_id: who.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def mates!(one, two)
    one.follow!(two)
    two.follow!(one)
  end

  def post_on_profile(visibility: 'public', text: 'Happy birthday!')
    post '/api/v1/statuses', headers: headers, params: { status: text, visibility: visibility, profile_account_id: owner.account.id }
  end

  def timeline_of(account, as:)
    get "/api/v1/accounts/#{account.id}/statuses", headers: headers_for(as)
    response.parsed_body.pluck('content').join
  end

  context 'when you are their Mate' do
    before { mates!(me, owner.account) }

    it 'puts the post on their profile, still as yours, and tells them' do
      post_on_profile

      expect(response).to have_http_status(200)
      expect(response.parsed_body['profile_account']).to include('id' => owner.account.id.to_s, 'acct' => 'ana')
      expect(Status.last).to have_attributes(account_id: me.id, profile_account_id: owner.account.id)
      expect(Nudges::Event.where(recipient_account_id: owner.account.id, source_korner_slug: 'profile', verb: 'posted_on')).to exist
      expect(timeline_of(owner.account, as: owner)).to include('Happy birthday!')
      expect(timeline_of(me, as: user)).to include('Happy birthday!')
    end

    it 'shows a public one to anyone looking at the profile, and a Mates one only to your Mates' do
      post_on_profile
      expect(timeline_of(owner.account, as: stranger)).to include('Happy birthday!')

      post_on_profile(visibility: 'mates', text: 'Between Mates')
      expect(timeline_of(owner.account, as: stranger)).to_not include('Between Mates')
      expect(timeline_of(owner.account, as: owner)).to include('Between Mates')

      mates!(me, stranger.account)
      expect(timeline_of(owner.account, as: stranger)).to include('Between Mates')
    end

    it 'does not take a post meant for you alone' do
      post_on_profile(visibility: 'self_only')

      expect(response).to have_http_status(422)
    end

    it 'is refused once they turn posts from Mates off' do
      put '/api/v1/settings/privacy', headers: headers_for(owner), params: { profile_posts: false }
      expect(response.parsed_body.dig('values', 'profile_posts')).to be false

      post_on_profile

      expect(response).to have_http_status(403)
    end

    it 'lets them take it off their profile, which leaves the post yours' do
      post_on_profile
      status = Status.last

      delete "/api/v1/statuses/#{status.id}/profile_post", headers: headers
      expect(response).to have_http_status(403)

      delete "/api/v1/statuses/#{status.id}/profile_post", headers: headers_for(owner)
      expect(response).to have_http_status(200)
      expect(status.reload.profile_account_id).to be_nil
      expect(timeline_of(owner.account, as: owner)).to_not include('Happy birthday!')
      expect(timeline_of(me, as: user)).to include('Happy birthday!')
    end
  end

  it 'is refused when you are not their Mate' do
    post_on_profile

    expect(response).to have_http_status(403)
    expect(Status.where(account_id: me.id)).to be_empty
  end

  it 'serves the Timeline face at its own address' do
    get "/@#{owner.account.username}/posts"

    expect(response).to have_http_status(200)
  end

  it 'leaves an ordinary post without a profile' do
    post '/api/v1/statuses', headers: headers, params: { status: 'Just a post', visibility: 'public' }

    expect(response.parsed_body).to_not include('profile_account')
  end
end
