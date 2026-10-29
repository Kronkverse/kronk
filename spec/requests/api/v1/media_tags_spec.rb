# frozen_string_literal: true

require 'rails_helper'

# Tagging people in a photo (a post's, a Moment's): only yourself or your
# Mates (Tal 2026-10-29; docs/spaces/feed.md, Mentions).
RSpec.describe 'API V1 Media Tags' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:mate)    { Fabricate(:account) }
  let(:stranger) { Fabricate(:account) }
  let(:media) { Fabricate(:media_attachment, account: user.account, status: nil) }

  before do
    user.account.follow!(mate)
    mate.follow!(user.account)
  end

  def tag(account)
    post "/api/v1/media/#{media.id}/tags", headers: headers, params: { account_id: account.id, x: 0.5, y: 0.5 }
  end

  it 'tags a Mate' do
    tag(mate)

    expect(response).to have_http_status(200)
    expect(media.media_tags.pluck(:account_id)).to eq [mate.id]
  end

  it 'tags yourself' do
    tag(user.account)

    expect(response).to have_http_status(200)
  end

  it 'refuses someone who is not your Mate', :aggregate_failures do
    tag(stranger)

    expect(response).to have_http_status(422)
    expect(response.parsed_body['error']).to eq 'You can only tag your Mates.'
    expect(media.media_tags).to be_empty
  end

  it 'refuses someone you follow who does not follow back' do
    user.account.follow!(stranger)

    tag(stranger)

    expect(response).to have_http_status(422)
  end

  it 'keeps a tag made before, and lists it' do
    MediaTag.create!(media_attachment: media, account: stranger, created_by_account: user.account, x: 0.5, y: 0.5)

    get "/api/v1/media/#{media.id}/tags", headers: headers

    expect(response.parsed_body.pluck('account_id')).to eq [stranger.id.to_s]
  end
end
