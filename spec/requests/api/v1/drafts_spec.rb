# frozen_string_literal: true

require 'rails_helper'

# docs/design.md, Drafts: every composer saves what is being written as it
# goes, in one table, and each draft is its owner's alone.
RSpec.describe 'Drafts' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:photo)   { Fabricate(:media_attachment, account: user.account, status: nil) }
  let(:theirs)  { Fabricate(:media_attachment, status: nil) }

  def start_draft(**body)
    post '/api/v1/drafts', headers: headers, params: { korner: 'kalendar', kind: 'event' }.merge(body), as: :json
    response.parsed_body
  end

  it 'keeps whatever the composer sends, with only your own uploads' do
    draft = start_draft(version: 2, params: { title: 'Working bee', tickets: [{ name: 'Free' }] },
                        media_ids: [theirs.id.to_s, photo.id.to_s])

    expect(response).to have_http_status(200)
    expect(draft).to include('korner' => 'kalendar', 'kind' => 'event', 'context' => nil, 'version' => 2)
    expect(draft['params']).to eq('title' => 'Working bee', 'tickets' => [{ 'name' => 'Free' }])
    expect(draft['media_attachments'].pluck('id')).to eq([photo.id.to_s])
  end

  it "lists one composer's drafts, newest first, and keeps contexts apart" do
    first = start_draft(params: { title: 'One' })
    second = start_draft(params: { title: 'Two' })
    start_draft(context: 'krew:7', params: { title: 'For the Krew' })
    start_draft(kind: 'huddle', params: { title: 'Another composer' })
    put "/api/v1/drafts/#{first['id']}", headers: headers, params: { params: { title: 'One, again' } }, as: :json

    get '/api/v1/drafts', headers: headers, params: { korner: 'kalendar', kind: 'event' }
    expect(response.parsed_body.pluck('id')).to eq([first['id'], second['id']])

    get '/api/v1/drafts', headers: headers, params: { korner: 'kalendar', kind: 'event', context: 'krew:7' }
    expect(response.parsed_body.map { |d| d['params']['title'] }).to eq(['For the Krew'])
  end

  it 'never moves a draft to another composer' do
    draft = start_draft(params: { title: 'Stays put' })
    put "/api/v1/drafts/#{draft['id']}", headers: headers, params: { korner: 'albutts', kind: 'album', params: {} }, as: :json

    expect(Draft.find(draft['id'])).to have_attributes(korner: 'kalendar', kind: 'event')
  end

  it 'refuses a space that does not exist and params that are not an object' do
    start_draft(korner: 'nowhere')
    expect(response).to have_http_status(422)

    start_draft(params: 'just text')
    expect(response).to have_http_status(422)
  end

  it "doesn't show or touch anyone else's drafts" do
    theirs_draft = Draft.create!(account: Fabricate(:account), korner: 'kalendar', kind: 'event', params: { 'title' => 'Private' })

    get '/api/v1/drafts', headers: headers, params: { korner: 'kalendar', kind: 'event' }
    expect(response.parsed_body).to eq([])

    get "/api/v1/drafts/#{theirs_draft.id}", headers: headers
    expect(response).to have_http_status(404)
    put "/api/v1/drafts/#{theirs_draft.id}", headers: headers, params: { params: { title: 'Mine now' } }, as: :json
    expect(response).to have_http_status(404)
    delete "/api/v1/drafts/#{theirs_draft.id}", headers: headers
    expect(response).to have_http_status(404)
    expect(theirs_draft.reload.params['title']).to eq('Private')
  end

  it 'discards a draft' do
    draft = start_draft(params: { title: 'Gone soon' })
    delete "/api/v1/drafts/#{draft['id']}", headers: headers

    expect(response).to have_http_status(200)
    expect(Draft.exists?(draft['id'])).to be(false)
  end

  it 'caps how many drafts one composer keeps' do
    stub_const('Draft::MAX_PER_COMPOSER', 1)
    start_draft(params: { title: 'One' })
    start_draft(params: { title: 'Two' })

    expect(response).to have_http_status(422)
  end

  it 'shares the post composer draft with the old single-draft endpoint' do
    put '/api/v1/draft', headers: headers, params: { text: 'Half a thought' }, as: :json
    get '/api/v1/drafts', headers: headers, params: { korner: 'feed', kind: 'post' }

    expect(response.parsed_body.map { |d| d['params']['text'] }).to eq(['Half a thought'])
  end
end
