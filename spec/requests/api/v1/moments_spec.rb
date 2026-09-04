# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Moments' do
  # `let!` so the viewer's account exists before the Moment. An account is
  # seeded a per-korner seen baseline at creation
  # (`Account#seed_korner_seen_baselines`) covering everything that already
  # exists, so a lazily-created viewer counts the Moment as seen before ever
  # opening it — which makes "unseen Moment" untestable.
  let!(:user) { Fabricate(:user) }
  let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let(:author) { Fabricate(:account) }
  let(:media)  { Fabricate(:media_attachment, account: author) }
  let(:moment) { Moment.create!(account: author, media_attachment: media, visibility: :public) }

  describe 'GET /api/v1/moments/:id' do
    it 'marks the Moment seen for the viewer and reports seen_by_viewer' do
      expect do
        get "/api/v1/moments/#{moment.id}", headers: headers
      end.to change { KornerContentView.where(account: user.account, korner_slug: 'moments', content_id: moment.id).count }.from(0).to(1)

      expect(response).to have_http_status(200)
      expect(response.parsed_body['seen_by_viewer']).to be(true)
    end
  end

  describe 'GET /api/v1/moments' do
    it 'reports seen_by_viewer false for an unseen Moment' do
      moment # create it

      get '/api/v1/moments', headers: headers

      row = response.parsed_body.find { |m| m['id'] == moment.id.to_s }
      expect(row['seen_by_viewer']).to be(false)
    end
  end
end
