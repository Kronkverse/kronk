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

    it 'does not take a direct one' do
      post_on_profile(visibility: 'direct')

      expect(response).to have_http_status(422)
    end

    # "Only on <name>'s profile" (docs/spaces/profile.md, Posts from Mates;
    # decisions.md 2026-10-29): `self_only` with a profile.
    context 'when it is only on their profile' do
      let(:my_mate)    { Fabricate(:user) }
      let(:their_mate) { Fabricate(:user) }
      let(:outsider)   { Fabricate(:user) }

      before do
        mates!(me, my_mate.account)
        mates!(owner.account, their_mate.account)
        outsider.account.follow!(me)
        outsider.account.follow!(owner.account)
      end

      def home_feed_of(account)
        HomeFeed.new(account).get(40).map(&:id)
      end

      def show_status(status, as:)
        get "/api/v1/statuses/#{status.id}", headers: as ? headers_for(as) : {}
      end

      it 'is on their profile for whoever can see it, and in no feed at all' do
        post_on_profile(visibility: 'self_only', text: 'Just here')
        status = Status.last

        expect(response).to have_http_status(200)
        expect(status).to have_attributes(visibility: 'self_only', profile_account_id: owner.account.id)
        expect(Nudges::Event.where(recipient_account_id: owner.account.id, source_korner_slug: 'profile', verb: 'posted_on')).to exist

        [user, owner, stranger, my_mate].each do |viewer|
          expect(timeline_of(owner.account, as: viewer)).to include('Just here')
        end
        expect(timeline_of(me, as: user)).to include('Just here')

        [me, owner.account, my_mate.account, their_mate.account, outsider.account, stranger.account].each do |account|
          expect(home_feed_of(account)).to_not include(status.id)
        end
      end

      it 'is hidden with the profile from those who cannot see it' do
        owner.account.update!(profile_visibility: :mates)
        post_on_profile(visibility: 'self_only', text: 'Just here')
        status = Status.last

        expect(timeline_of(owner.account, as: stranger)).to_not include('Just here')
        show_status(status, as: stranger)
        expect(response).to have_http_status(404)
        show_status(status, as: nil)
        expect(response).to have_http_status(404)

        show_status(status, as: their_mate)
        expect(response).to have_http_status(200)
        expect(timeline_of(owner.account, as: their_mate)).to include('Just here')
      end

      it 'opens for anyone who can see the profile, and not when signed out' do
        post_on_profile(visibility: 'self_only')
        status = Status.last

        show_status(status, as: stranger)
        expect(response).to have_http_status(200)
        show_status(status, as: nil)
        expect(response).to have_http_status(404)
      end

      it 'cannot be boosted' do
        post_on_profile(visibility: 'self_only')
        status = Status.last

        post "/api/v1/statuses/#{status.id}/reblog", headers: headers_for(stranger)

        expect(response).to_not have_http_status(200)
        expect(Status.where(reblog_of_id: status.id)).to be_empty
      end

      it 'takes no Krews or added people' do
        krew = Krew.create!(slug: 'walkers', name: 'Walkers', access: 'open')
        krew.krew_memberships.create!(account: me)
        krew.krew_memberships.create!(account: outsider.account)

        post '/api/v1/statuses', headers: headers, params: {
          status: 'Just here', visibility: 'self_only', profile_account_id: owner.account.id,
          krew_ids: [krew.id], audience_grant_ids: [outsider.account.id]
        }
        status = Status.last

        expect(status.krews).to be_empty
        expect(status.granted_accounts).to be_empty
        expect(home_feed_of(outsider.account)).to_not include(status.id)
      end

      it 'shows comments under it to whoever can see the post' do
        post_on_profile(visibility: 'self_only')
        status = Status.last

        post '/api/v1/statuses', headers: headers_for(owner), params: { status: 'Thank you!', in_reply_to_id: status.id }
        reply = Status.last

        show_status(reply, as: stranger)
        expect(response).to have_http_status(200)

        get "/api/v1/statuses/#{status.id}/context", headers: headers_for(stranger)
        expect(response.parsed_body['descendants'].pluck('id')).to include(reply.id.to_s)
      end

      it 'tells its author who can see it' do
        post_on_profile(visibility: 'self_only')

        get "/api/v1/statuses/#{Status.last.id}/audience", headers: headers

        expect(response.parsed_body['profile_account']).to include('id' => owner.account.id.to_s, 'acct' => 'ana')
      end
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
