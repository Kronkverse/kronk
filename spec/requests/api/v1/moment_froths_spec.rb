# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Moment froths' do
  # `let!` so the froather's account exists before the Moment below. An
  # account is seeded a per-korner seen baseline at creation
  # (`Account#seed_korner_seen_baselines`), so an account created lazily —
  # after the Moment — already counts it as seen and the froth has no
  # per-item row left to write.
  let!(:user) { Fabricate(:user) }
  let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:favourites') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let(:author) { Fabricate(:account) }
  let(:media)  { Fabricate(:media_attachment, account: author) }
  let(:moment) { Moment.create!(account: author, media_attachment: media, visibility: :public) }

  describe 'POST /api/v1/moments/:moment_id/froth' do
    it 'creates the froth and marks the Moment seen for the froather' do
      expect do
        post "/api/v1/moments/#{moment.id}/froth", headers: headers
      end.to change { MomentFroth.where(account: user.account, moment: moment).count }.from(0).to(1)

      expect(response).to have_http_status(200)
      expect(KornerContentView.where(account: user.account, korner_slug: 'moments', content_id: moment.id)).to exist
    end

    it 'reports frothed_by_viewer true in the response' do
      post "/api/v1/moments/#{moment.id}/froth", headers: headers

      expect(response.parsed_body['frothed_by_viewer']).to be(true)
    end

    it 'still records the seen row on a duplicate froth (idempotent)' do
      moment.moment_froths.create!(account: user.account)

      post "/api/v1/moments/#{moment.id}/froth", headers: headers

      expect(response).to have_http_status(200)
      expect(KornerContentView.where(account: user.account, korner_slug: 'moments', content_id: moment.id)).to exist
    end
  end
end
