# frozen_string_literal: true

require 'rails_helper'

# Kommons "Add share function to proposals": share a proposal to your feed
# with a note (docs/spaces/kommons.md, Sharing a proposal).
RSpec.describe 'Sharing a proposal to the feed' do
  let(:proposer_user) { Fabricate(:user) }
  let(:sharer_user)   { Fabricate(:user) }
  let(:proposal) do
    Proposal.create!(title: 'Build the thing', body: 'It would help.', created_by_account_id: proposer_user.account.id)
  end
  let(:link) { "/hub/kommons/p/#{proposal.id}" }

  def auth_headers(user, scopes: 'read write')
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes)
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def share(as:, **params)
    post "/api/v1/proposals/#{proposal.id}/share", params: params, headers: auth_headers(as)
  end

  it 'posts your note with the proposal’s link, at the reach you pick' do
    share(as: sharer_user, comment: 'Worth backing', visibility: 'mates')

    expect(response).to have_http_status(200)
    status = Status.find(response.parsed_body['id'])
    expect(status).to have_attributes(account: sharer_user.account, visibility: 'mates')
    expect(status.text).to start_with('Worth backing').and include(link)
  end

  it 'uses the proposal’s title when there is no note' do
    share(as: sharer_user)

    expect(Status.find(response.parsed_body['id']).text).to start_with('Build the thing').and include(link)
  end

  it 'leaves the proposal’s own post, its discussion, where it is' do
    own_post = Fabricate(:status, account: proposer_user.account)
    proposal.update_columns(status_id: own_post.id, discussion_status_id: own_post.id)

    share(as: sharer_user, comment: 'Look')

    expect(proposal.reload).to have_attributes(status_id: own_post.id, discussion_status_id: own_post.id)
  end

  it 'refuses a withdrawn proposal' do
    proposal.update!(status: :annulled)

    expect { share(as: sharer_user) }.to_not change(Status, :count)
    expect(response).to have_http_status(403)
  end

  it 'needs a token that can write' do
    expect do
      post "/api/v1/proposals/#{proposal.id}/share", headers: auth_headers(sharer_user, scopes: 'read')
    end.to_not change(Status, :count)
    expect(response).to have_http_status(403)
  end

  it 'needs you to be signed in' do
    post "/api/v1/proposals/#{proposal.id}/share"

    expect(response).to have_http_status(401)
  end
end
