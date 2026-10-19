# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/moments.md, Views: the owner sees how many people have seen a
# Moment, and who. Nobody else does.
RSpec.describe 'Moment views' do
  let(:author_user) { Fabricate(:user) }
  let(:author)      { author_user.account }
  let(:viewer_user) { Fabricate(:user) }
  let(:viewer)      { viewer_user.account }
  let(:media)       { Fabricate(:media_attachment, account: author) }
  let(:moment)      { Moment.create!(account: author, media_attachment: media, visibility: :public) }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  it 'counts each viewer once, and not the owner' do
    2.times { post "/api/v1/moments/#{moment.id}/view", headers: headers_for(viewer_user) }
    post "/api/v1/moments/#{moment.id}/view", headers: headers_for(author_user)
    get "/api/v1/moments/#{moment.id}", headers: headers_for(Fabricate(:user))

    expect(response).to have_http_status(200)
    expect(moment.reload.views_count).to eq(2)
    expect(moment.moment_views.count).to eq(2)
  end

  it 'shows the owner the count and who, newest first' do
    first = Fabricate(:user)
    post "/api/v1/moments/#{moment.id}/view", headers: headers_for(first)
    travel 1.minute
    post "/api/v1/moments/#{moment.id}/view", headers: headers_for(viewer_user)

    get "/api/v1/moments/#{moment.id}/views", headers: headers_for(author_user)
    expect(response).to have_http_status(200)
    expect(response.parsed_body.map { |v| v['account']['id'] }).to eq([viewer.id.to_s, first.account.id.to_s])

    get "/api/v1/moments/#{moment.id}", headers: headers_for(author_user)
    expect(response.parsed_body['views_count']).to eq(2)
  end

  it 'keeps the count and the list from everyone but the owner' do
    post "/api/v1/moments/#{moment.id}/view", headers: headers_for(viewer_user)

    get "/api/v1/moments/#{moment.id}/views", headers: headers_for(viewer_user)
    expect(response).to have_http_status(404)

    get "/api/v1/moments/#{moment.id}", headers: headers_for(viewer_user)
    expect(response.parsed_body).to_not have_key('views_count')
  end

  it "doesn't record a view of a Moment you can't see" do
    hidden = Moment.create!(account: author, media_attachment: Fabricate(:media_attachment, account: author), visibility: :self_only)

    post "/api/v1/moments/#{hidden.id}/view", headers: headers_for(viewer_user)
    expect(response).to have_http_status(404)
    expect(hidden.reload.views_count).to eq(0)
  end
end
