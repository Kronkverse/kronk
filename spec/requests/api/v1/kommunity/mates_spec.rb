# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Kommunity mates list' do
  let(:user)    { Fabricate(:user, current_sign_in_at: 1.day.ago) }
  let(:viewer)  { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:accounts') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def member(username, findable: :everyone, posted: nil)
    Fabricate(:account, username: username).tap do |account|
      account.update!(kommunity_discoverability: findable)
      account.account_stat.update!(last_status_at: posted) if posted
    end
  end

  def mate!(other)
    viewer.follow!(other)
    other.follow!(viewer)
  end

  def listed
    response.parsed_body.pluck(:username)
  end

  it 'requires a signed-in user' do
    get '/api/v1/kommunity/mates'

    expect(response).to have_http_status(401)
  end

  describe 'GET /api/v1/kommunity/mates' do
    let!(:quiet)    { member('quiet') }
    let!(:old_post) { member('old_post', posted: 3.days.ago) }
    let!(:new_post) { member('new_post', posted: 1.hour.ago) }
    let!(:hidden)   { member('hidden', findable: :nobody, posted: 1.day.ago) }
    let!(:muted)    { member('muted', posted: 2.hours.ago) }
    let!(:one_way)  { member('one_way', posted: 1.minute.ago) }

    before do
      [quiet, old_post, new_post, hidden, muted].each { |account| mate!(account) }
      viewer.follow!(one_way)
      viewer.mute!(muted)
    end

    it 'lists only Mates, most recent poster first, never-posted last' do
      get '/api/v1/kommunity/mates', headers: headers

      expect(response).to have_http_status(200)
      expect(listed).to eq %w(new_post hidden old_post quiet)
    end

    it 'searches by name' do
      get '/api/v1/kommunity/mates', params: { q: 'post' }, headers: headers

      expect(listed).to eq %w(new_post old_post)
    end

    it 'pages by offset with a next link' do
      get '/api/v1/kommunity/mates', params: { limit: 2 }, headers: headers

      expect(listed).to eq %w(new_post hidden)
      expect(response.headers['Link'].to_s).to include('/api/v1/kommunity/mates', 'offset=2')
    end
  end
end
