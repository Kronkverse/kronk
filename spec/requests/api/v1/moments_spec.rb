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

  # The standard reactions bar (Reply · Froth · Nudge) rides a backing
  # Status minted on create (proposal #117299797205667928). That Status
  # must be exactly as visible as the Moment and never appear anywhere a
  # post would.
  describe 'the backing Status' do
    let(:poster)        { Fabricate(:user) }
    let(:poster_token)  { Fabricate(:accessible_access_token, resource_owner_id: poster.id, scopes: 'read write') }
    let(:poster_headers) { { 'Authorization' => "Bearer #{poster_token.token}" } }
    let(:mate)          { user.account }
    let(:stranger)      { Fabricate(:user).account }
    let(:mate_token)    { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
    let(:mate_headers)  { { 'Authorization' => "Bearer #{mate_token.token}" } }
    let(:photo)         { Fabricate(:media_attachment, account: poster.account) }

    before do
      poster.account.follow!(mate)
      mate.follow!(poster.account)
    end

    def post_moment(caption: 'sunset at the river', visibility: 'mates')
      post '/api/v1/moments', params: { media_attachment_id: photo.id, caption: caption, visibility: visibility }, headers: poster_headers
      expect(response).to have_http_status(200)
      Moment.find(response.parsed_body['id'])
    end

    it 'is minted on create with the Moment audience and no media of its own' do
      moment = post_moment

      expect(moment.status).to be_present
      expect(moment.status).to be_kronk_moment
      expect(moment.status.visibility).to eq 'mates'
      expect(moment.status.source_korner).to eq 'moments'
      expect(moment.status.media_attachments).to be_empty
      expect(photo.reload.status_id).to be_nil
      expect(response.parsed_body.dig('status', 'id')).to eq moment.status_id.to_s
    end

    it 'is minted for an uncaptioned Moment' do
      moment = post_moment(caption: '')

      expect(moment.status).to be_present
    end

    it 'never reaches a home feed, a profile or the media tab' do
      moment = post_moment

      expect(Status.new(post_type: :moment)).to be_kronk_feed_suppressed
      expect(moment.status.send(:satisfies_search_condition?)).to be false
      expect(HomeFeed.new(mate).get(20).map(&:id)).to_not include(moment.status_id)

      get "/api/v1/accounts/#{poster.account_id}/statuses", headers: mate_headers
      expect(response.parsed_body.pluck('id')).to_not include(moment.status_id.to_s)

      get "/api/v1/accounts/#{poster.account_id}/statuses", params: { only_media: true }, headers: mate_headers
      expect(response.parsed_body.pluck('id')).to_not include(moment.status_id.to_s)

      get "/api/v1/accounts/#{poster.account_id}/statuses", headers: poster_headers
      expect(response.parsed_body.pluck('id')).to_not include(moment.status_id.to_s)
    end

    it 'is visible to a mate while active and to nobody but the author once expired' do
      moment = post_moment

      get "/api/v1/statuses/#{moment.status_id}", headers: mate_headers
      expect(response).to have_http_status(200)

      expect(StatusPolicy.new(stranger, moment.status).show?).to be false

      moment.update!(expires_at: 1.minute.ago)
      get "/api/v1/statuses/#{moment.status_id}", headers: mate_headers
      expect(response).to have_http_status(404)
      expect(StatusPolicy.new(poster.account, moment.status.reload).show?).to be true
    end

    it 'is hidden from a mate the author has blocked' do
      moment = post_moment
      poster.account.block!(mate)

      get "/api/v1/statuses/#{moment.status_id}", headers: mate_headers
      expect(response).to have_http_status(404)
    end

    it 'takes a froth through the standard favourite endpoint, and the Moment reports it' do
      moment = post_moment

      post "/api/v1/statuses/#{moment.status_id}/favourite", headers: mate_headers
      expect(response).to have_http_status(200)

      get "/api/v1/moments/#{moment.id}", headers: mate_headers
      expect(response.parsed_body['froth_count']).to eq 1
      expect(response.parsed_body['frothed_by_viewer']).to be true
    end

    it 'follows an audience change' do
      moment = post_moment

      put "/api/v1/moments/#{moment.id}", params: { visibility: 'self_only' }, headers: poster_headers
      expect(response).to have_http_status(200)
      expect(moment.status.reload.visibility).to eq 'self_only'
    end

    it 'takes a caption edit through the Moment, and the Status follows' do
      moment = post_moment

      put "/api/v1/moments/#{moment.id}", params: { caption: 'river at dusk' }, headers: poster_headers
      expect(response).to have_http_status(200)
      expect(response.parsed_body['caption']).to eq 'river at dusk'
      expect(moment.status.reload.text).to eq 'river at dusk'
      expect(moment.status.edited_at).to be_present
    end

    it 'refuses editing the backing Status directly' do
      moment = post_moment

      put "/api/v1/statuses/#{moment.status_id}", params: { status: 'sneaky' }, headers: poster_headers
      expect(response).to have_http_status(403)
      expect(moment.status.reload.text).to eq 'sunset at the river'
    end

    it "doesn't let anyone else edit the caption" do
      moment = post_moment

      put "/api/v1/moments/#{moment.id}", params: { caption: 'not mine' }, headers: mate_headers
      expect(response).to have_http_status(403)
      expect(moment.reload.caption).to eq 'sunset at the river'
    end

    it 'is removed with the Moment, and the Moment media survives removal of the Status' do
      moment = post_moment
      status_id = moment.status_id

      Sidekiq::Testing.inline! do
        delete "/api/v1/moments/#{moment.id}", headers: poster_headers
      end

      expect(response).to have_http_status(200)
      expect(Status.with_discarded.find_by(id: status_id)).to be_nil.or(have_attributes(discarded?: true))
      expect(MediaAttachment.exists?(photo.id)).to be true
    end
  end
end
