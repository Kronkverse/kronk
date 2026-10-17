# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/albutts.md, Drafts: an album in progress is saved as you go,
# photos included, and is its owner's alone.
RSpec.describe 'Album drafts' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:photo)   { Fabricate(:media_attachment, account: user.account, status: nil) }
  let(:other)   { Fabricate(:media_attachment, account: user.account, status: nil) }
  let(:theirs)  { Fabricate(:media_attachment, status: nil) }

  def save_draft(id: nil, **params)
    if id
      put "/api/v1/albutts/drafts/#{id}", headers: headers, params: params, as: :json
    else
      post '/api/v1/albutts/drafts', headers: headers, params: params, as: :json
    end
    response.parsed_body
  end

  it 'keeps the album and its photos in order, only your own uploads' do
    draft = save_draft(title: 'Beach day', visibility: 'mates', media_ids: [other.id, theirs.id, photo.id].map(&:to_s),
                       captions: { photo.id.to_s => 'Sunset' })

    expect(response).to have_http_status(200)
    expect(draft['params']).to include('title' => 'Beach day', 'visibility' => 'mates', 'captions' => { photo.id.to_s => 'Sunset' })
    expect(draft['media_attachments'].pluck('id')).to eq([other.id.to_s, photo.id.to_s])
  end

  it 'saves over the same draft and lists yours, newest first' do
    first = save_draft(title: 'One')
    second = save_draft(title: 'Two')
    save_draft(id: first['id'], title: 'One, renamed', media_ids: [photo.id.to_s])

    get '/api/v1/albutts/drafts', headers: headers
    expect(response.parsed_body.map { |d| d['params']['title'] }).to eq(['One, renamed', 'Two'])
    expect(response.parsed_body.pluck('id')).to eq([first['id'], second['id']])
  end

  it "doesn't show or touch anyone else's drafts" do
    theirs_draft = AlbumDraft.create!(account: Fabricate(:account), params: { 'title' => 'Private' })

    get '/api/v1/albutts/drafts', headers: headers
    expect(response.parsed_body).to eq([])

    put "/api/v1/albutts/drafts/#{theirs_draft.id}", headers: headers, params: { title: 'Mine now' }, as: :json
    expect(response).to have_http_status(404)
    delete "/api/v1/albutts/drafts/#{theirs_draft.id}", headers: headers
    expect(response).to have_http_status(404)
    expect(theirs_draft.reload.params['title']).to eq('Private')
  end

  it 'discards a draft' do
    draft = save_draft(title: 'Gone soon')
    delete "/api/v1/albutts/drafts/#{draft['id']}", headers: headers

    expect(response).to have_http_status(200)
    expect(AlbumDraft.exists?(draft['id'])).to be(false)
  end

  it 'caps how many drafts one account keeps' do
    stub_const('AlbumDraft::MAX_PER_ACCOUNT', 1)
    save_draft(title: 'One')
    save_draft(title: 'Two')

    expect(response).to have_http_status(422)
  end
end
