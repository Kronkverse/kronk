# frozen_string_literal: true

require 'rails_helper'

# Attaching between korners with the real manifests: every korner whose
# records can be linked can link out too (decisions.md, 2026-10-21), whoever
# looks after a record decides what it links to, and links show at both ends.
RSpec.describe 'Attachments across korners' do
  let(:user)  { Fabricate(:user) }
  let(:other) { Fabricate(:user) }
  let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let(:album)    { Album.create!(owner: user.account, title: 'Roadtrip', visibility: :public) }
  let(:proposal) { Fabricate(:proposal, created_by_account: other.account, title: 'Build a shed') }

  before { Kronk::KornerRegistry.reload! }

  def attach(source_slug, source, target_slug, target)
    post '/api/v1/attachments', headers: headers, params: {
      source_slug: source_slug, source_id: source.id, target_slug: target_slug, target_id: target.id, kind: 'link'
    }
  end

  # Opt-out, not opt-in: a korner with records takes links, or its manifest
  # says why not (`no_attachments:`). A new korner that does neither fails
  # here, with what to add.
  it 'has every korner with records either take links or say why not' do
    gaps = Kronk::KornerRegistry.all.flat_map { |manifest| Kronk::KornerRecords.attachment_gaps(manifest) }

    expect(gaps).to be_empty, gaps.join("\n")
    expect(Kronk::KornerRegistry.all.select { |m| m.no_attachments.present? }.map(&:slug)).to contain_exactly('inflow', 'klot', 'moments', 'nudges', 'rose')
  end

  it 'lets an album link to a proposal, shown from both ends at its real page' do
    attach('albutts', album, 'kommons', proposal)
    expect(response).to have_http_status(200)
    expect(response.parsed_body['target']).to include('title' => 'Build a shed', 'url' => "/hub/kommons/p/#{proposal.id}")

    get "/api/v1/attachments?target=kommons/#{proposal.id}", headers: headers
    expect(response.parsed_body.map { |row| row['source']['url'] }).to eq(["/hub/albutts/albums/#{album.id}"])
  end

  it 'lets whoever proposed a proposal link it, and nobody else' do
    attach('kommons', proposal, 'albutts', album)
    expect(response).to have_http_status(403)

    proposal.update!(created_by_account: user.account)
    attach('kommons', proposal, 'albutts', album)
    expect(response).to have_http_status(200)
  end

  it 'lets anyone in a Krew link it' do
    krew = Krew.create!(slug: 'shedders', name: 'Shedders', access: 'open')
    attach('krew', krew, 'albutts', album)
    expect(response).to have_http_status(403)

    krew.krew_memberships.create!(account: user.account, role: 'member', source: 'direct')
    attach('krew', krew, 'albutts', album)
    expect(response).to have_http_status(200)
    expect(response.parsed_body['source']['url']).to eq('/hub/krew/shedders')
  end

  it 'refuses to link a record to another in its own korner' do
    attach('albutts', album, 'albutts', Album.create!(owner: user.account, title: 'Second trip', visibility: :public))
    expect(response).to have_http_status(422)
  end

  it 'takes the links away when either end is deleted' do
    attach('albutts', album, 'kommons', proposal)
    expect { proposal.destroy! }.to change(KornerAttachment, :count).by(-1)

    attach('albutts', album, 'booth', Fabricate(:booth_set, account: user.account))
    expect { album.destroy! }.to change(KornerAttachment, :count).by(-1)
  end

  describe 'searching for something to attach' do
    it 'finds proposals, which it could not before' do
      proposal
      get '/api/v1/attachments/candidates?korner=kommons&q=shed', headers: headers
      expect(response.parsed_body.pluck('title')).to eq(['Build a shed'])
    end

    it 'finds an invite-only Krew only for its members' do
      krew = Krew.create!(slug: 'quiet', name: 'Quiet ones', access: 'invite_only')
      get '/api/v1/attachments/candidates?korner=krew&q=quiet', headers: headers
      expect(response.parsed_body).to be_empty

      krew.krew_memberships.create!(account: user.account, role: 'member', source: 'direct')
      get '/api/v1/attachments/candidates?korner=krew&q=quiet', headers: headers
      expect(response.parsed_body.pluck('title')).to eq(['Quiet ones'])
    end

    it 'finds nothing in a korner that takes no links' do
      get '/api/v1/attachments/candidates?korner=klot', headers: headers
      expect(response).to have_http_status(200)
      expect(response.parsed_body).to be_empty
    end
  end
end
