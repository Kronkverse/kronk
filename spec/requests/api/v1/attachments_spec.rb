# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Attachments' do
  # Phase 1 API surface: index by source/target, POST for user-added
  # link/reference (spawn is framework-only), DELETE for either end.
  # Uses stubbed manifests so the API surface is exercised without
  # requiring any real korner to have opted in.

  let(:user) { Fabricate(:user) }
  let(:read_token)  { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses') }
  let(:write_token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:statuses') }

  let(:read_headers)  { { 'Authorization' => "Bearer #{read_token.token}" } }
  let(:write_headers) { { 'Authorization' => "Bearer #{write_token.token}" } }

  let(:source_record) do
    Event.create!(
      account: user.account,
      title: 'Src',
      start_time: 2.days.from_now,
      end_time: 2.days.from_now + 2.hours
    )
  end
  let(:target_record) { Album.create!(owner: user.account, title: 'Tgt', visibility: :public) }

  before do
    src_manifest = instance_double(
      Kronk::KornerRegistry::Manifest,
      slug: 'sourcekorner',
      attaches: [
        { 'to' => 'targetkorner', 'kind' => 'link' },
        { 'to' => 'targetkorner', 'kind' => 'spawn' },
      ],
      accepts: []
    )
    tgt_manifest = instance_double(
      Kronk::KornerRegistry::Manifest,
      slug: 'targetkorner',
      attaches: [],
      accepts: [
        { 'from' => 'sourcekorner', 'kind' => 'link' },
        { 'from' => 'sourcekorner', 'kind' => 'spawn' },
      ]
    )

    # Pass through to the real registry by default, THEN override the two
    # synthetic slugs below. Without the passthrough these are strict
    # argument matchers, so any other slug raises "received :find with
    # unexpected arguments" — and creating the real Event fixture fires
    # `Kronk::AttachmentSource#fire_kronk_spawn_attachments`, which looks
    # up its own korner ('kalendar'). That is what made every example in
    # this file fail.
    allow(Kronk::KornerRegistry).to receive(:find).and_call_original
    allow(Kronk::KornerRegistry).to receive(:model_for).and_call_original

    allow(Kronk::KornerRegistry).to receive(:find).with('sourcekorner').and_return(src_manifest)
    allow(Kronk::KornerRegistry).to receive(:find).with('targetkorner').and_return(tgt_manifest)
    allow(Kronk::KornerRegistry).to receive(:model_for).with('sourcekorner').and_return(Event)
    allow(Kronk::KornerRegistry).to receive(:model_for).with('targetkorner').and_return(Album)
  end

  describe 'GET /api/v1/attachments' do
    it 'returns 422 without a source or target query' do
      get '/api/v1/attachments', headers: read_headers
      expect(response).to have_http_status(422)
    end

    it 'lists attachments from a given source' do
      KornerAttachment.create!(
        source_slug: 'sourcekorner', source_id: source_record.id,
        target_slug: 'targetkorner', target_id: target_record.id,
        kind: 'link', created_by_account: user.account
      )
      get "/api/v1/attachments?source=sourcekorner/#{source_record.id}", headers: read_headers
      expect(response).to have_http_status(200)
      expect(response.parsed_body.length).to eq(1)
      expect(response.parsed_body.first['kind']).to eq('link')
    end
  end

  describe 'POST /api/v1/attachments' do
    let(:base_params) do
      {
        source_slug: 'sourcekorner', source_id: source_record.id.to_s,
        target_slug: 'targetkorner', target_id: target_record.id.to_s,
        kind: 'link'
      }
    end

    it 'creates a user-added link attachment' do
      expect do
        post '/api/v1/attachments', params: base_params, headers: write_headers
      end.to change(KornerAttachment, :count).by(1)
      expect(response).to have_http_status(200)
    end

    it 'refuses spawn (framework-only) via the API' do
      post '/api/v1/attachments', params: base_params.merge(kind: 'spawn'), headers: write_headers
      expect(response).to have_http_status(422)
    end

    it 'refuses when the user does not own the source' do
      other_source = Event.create!(
        account: Fabricate(:account),
        title: 'Other', start_time: 1.day.from_now, end_time: 1.day.from_now + 1.hour
      )
      post '/api/v1/attachments', params: base_params.merge(source_id: other_source.id.to_s), headers: write_headers
      expect(response).to have_http_status(403)
    end

    it 'returns 422 when manifests disagree' do
      # kind='reference' isn't in either synthetic manifest.
      post '/api/v1/attachments', params: base_params.merge(kind: 'reference'), headers: write_headers
      expect(response).to have_http_status(422)
    end
  end

  describe 'DELETE /api/v1/attachments/:id' do
    it 'lets the source-owner remove the row' do
      attachment = KornerAttachment.create!(
        source_slug: 'sourcekorner', source_id: source_record.id,
        target_slug: 'targetkorner', target_id: target_record.id,
        kind: 'link', created_by_account: user.account
      )
      expect do
        delete "/api/v1/attachments/#{attachment.id}", headers: write_headers
      end.to change(KornerAttachment, :count).by(-1)
    end

    it 'returns 404 for an unknown id' do
      delete '/api/v1/attachments/999999', headers: write_headers
      expect(response).to have_http_status(404)
    end
  end
end
