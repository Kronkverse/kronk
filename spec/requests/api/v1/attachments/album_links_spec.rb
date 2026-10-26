# frozen_string_literal: true

require 'rails_helper'

# An album linked to a Krew is one of the Krew's albums, whichever way it
# was linked, and unlinking from either end takes it out again
# (Kronk::AlbumLinks, decisions.md 2026-10-22).
RSpec.describe 'Album links to a Krew' do
  let(:author)  { Fabricate(:user) }
  let(:member)  { Fabricate(:user) }
  let(:krew)    { Krew.create!(slug: 'gardeners', name: 'Gardeners', access: 'open') }
  let(:album)   { Album.create!(owner: author.account, title: 'Seed swap', visibility: :self_only) }

  before do
    Kronk::KornerRegistry.reload!
    krew.krew_memberships.create!(account: author.account)
    krew.krew_memberships.create!(account: member.account)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def attach(user, source_slug, source_id, target_slug, target_id)
    post '/api/v1/attachments', headers: headers_for(user), params: {
      source_slug: source_slug, source_id: source_id, target_slug: target_slug, target_id: target_id, kind: 'link'
    }
    expect(response).to have_http_status(200)
    response.parsed_body['id']
  end

  def krew_album_ids
    get '/api/v1/albutts/albums', headers: headers_for(member), params: { krew_id: krew.id }
    response.parsed_body.pluck('id')
  end

  def linked?
    Kronk::AttachmentEffects.between('albutts', album.id, 'krew', krew.id).exists?
  end

  it 'makes an album attached from the album a Krew album' do
    attach(author, 'albutts', album.id, 'krew', krew.id)

    expect(album.reload.krew_ids).to eq([krew.id])
    expect(krew_album_ids).to eq([album.id.to_s])
  end

  it 'makes an album attached from the Krew a Krew album' do
    attach(author, 'krew', krew.id, 'albutts', album.id)

    expect(album.reload.krew_ids).to eq([krew.id])
    expect(krew_album_ids).to eq([album.id.to_s])
  end

  it 'leaves the audience alone when someone else attaches the album' do
    album.update!(visibility: :public)
    attach(member, 'krew', krew.id, 'albutts', album.id)

    expect(linked?).to be(true)
    expect(album.reload.album_krews).to be_empty
  end

  it "puts the Krew's Link button's album in both Attached blocks" do
    post "/api/v1/albutts/albums/#{album.id}/krews", headers: headers_for(author), params: { krew_id: krew.id }

    expect(response).to have_http_status(200)
    expect(linked?).to be(true)
    get '/api/v1/attachments', headers: headers_for(member), params: { target: "krew/#{krew.id}" }
    expect(response.parsed_body.pluck('source_id')).to include(album.id.to_s)
  end

  it 'unlinks from the album end' do
    id = attach(author, 'albutts', album.id, 'krew', krew.id)
    delete "/api/v1/attachments/#{id}", headers: headers_for(author)

    expect(album.reload.album_krews).to be_empty
    expect(krew_album_ids).to be_empty
  end

  it 'unlinks from the Krew end' do
    id = attach(author, 'krew', krew.id, 'albutts', album.id)
    delete "/api/v1/attachments/#{id}", headers: headers_for(member)

    expect(album.reload.album_krews).to be_empty
    expect(krew_album_ids).to be_empty
  end

  it "takes the link off with the Krew's Unlink button" do
    attach(author, 'albutts', album.id, 'krew', krew.id)
    delete "/api/v1/albutts/albums/#{album.id}/krews/#{krew.id}", headers: headers_for(author)

    expect(linked?).to be(false)
    expect(album.reload.album_krews).to be_empty
  end

  it 'links the Krews picked in the album composer, and unlinks the ones dropped' do
    put "/api/v1/albutts/albums/#{album.id}", headers: headers_for(author), params: { album: { title: 'Seed swap' }, krew_ids: [krew.id] }
    expect(linked?).to be(true)

    put "/api/v1/albutts/albums/#{album.id}", headers: headers_for(author), params: { album: { title: 'Seed swap' }, krew_ids: [''] }
    expect(linked?).to be(false)
  end

  it 'keeps a Krew album linked to its own Krew' do
    krew_album = Album.create!(owner: author.account, krew: krew, title: 'Mayhem', visibility: :self_only, contribution: :invited)
    krew_album.album_krews.create!(krew: krew, for_contribution: true)
    link = Kronk::AttachmentEffects.between('albutts', krew_album.id, 'krew', krew.id).first

    delete "/api/v1/attachments/#{link.id}", headers: headers_for(member)

    expect(response).to have_http_status(422)
    expect(krew_album.reload.album_krews.pluck(:krew_id)).to eq([krew.id])
  end
end
