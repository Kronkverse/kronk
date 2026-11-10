# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Bookmarks' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:scopes)  { 'read:bookmarks' }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  describe 'GET /api/v1/bookmarks' do
    subject do
      get '/api/v1/bookmarks', headers: headers, params: params
    end

    let(:params)     { {} }
    let!(:bookmarks) { Fabricate.times(2, :bookmark, account: user.account) }

    let(:expected_response) do
      bookmarks.map do |bookmark|
        a_hash_including(id: bookmark.status.id.to_s, account: a_hash_including(id: bookmark.status.account.id.to_s))
      end
    end

    it_behaves_like 'forbidden for wrong scope', 'write'

    it 'returns http success and the bookmarked statuses' do
      subject

      expect(response).to have_http_status(200)
      expect(response.content_type)
        .to start_with('application/json')
      expect(response.parsed_body).to match_array(expected_response)
    end

    context 'with limit param' do
      let(:params) { { limit: 1 } }

      it 'paginates correctly', :aggregate_failures do
        subject

        expect(response.parsed_body.size)
          .to eq(params[:limit])

        expect(response.content_type)
          .to start_with('application/json')
        expect(response)
          .to include_pagination_headers(
            prev: api_v1_bookmarks_url(limit: params[:limit], min_id: bookmarks.last.id),
            next: api_v1_bookmarks_url(limit: params[:limit], max_id: bookmarks.second.id)
          )
      end
    end

    # A comment never shows as a post of its own (docs/spaces/feed.md
    # (Comments)): the list shows the post it is on, naming the comment.
    context 'with a bookmarked comment' do
      let(:post)     { Fabricate(:status) }
      let(:comment)  { Fabricate(:status, thread: post) }
      let(:reply_to) { Fabricate(:status, thread: comment) }

      it 'shows the post with the comment named, once' do
        Fabricate(:bookmark, account: user.account, status: comment)
        Fabricate(:bookmark, account: user.account, status: reply_to)

        subject

        rows = response.parsed_body.select { |row| row[:id] == post.id.to_s }
        expect(rows.size).to eq 1
        expect(rows.first[:kronk_comment_id]).to eq reply_to.id.to_s
        expect(response.parsed_body.pluck(:id)).to_not include(comment.id.to_s, reply_to.id.to_s)
      end

      it 'leaves the comment out when its post is gone' do
        Fabricate(:bookmark, account: user.account, status: comment)
        post.destroy!

        subject

        expect(response.parsed_body.pluck(:id)).to_not include(comment.id.to_s, post.id.to_s)
      end

      it 'does not name a comment on a post bookmarked for itself' do
        Fabricate(:bookmark, account: user.account, status: comment)
        Fabricate(:bookmark, account: user.account, status: post)

        subject

        row = response.parsed_body.find { |r| r[:id] == post.id.to_s }
        expect(row).to_not have_key(:kronk_comment_id)
      end
    end

    context 'without the authorization header' do
      let(:headers) { {} }

      it 'returns http unauthorized' do
        subject

        expect(response).to have_http_status(401)
        expect(response.content_type)
          .to start_with('application/json')
      end
    end
  end
end
