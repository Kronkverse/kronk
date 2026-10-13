# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Nudges Mates' do
  let(:user)    { Fabricate(:user) }
  let(:me)      { user.account }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read:follows') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def mate(username, display_name = '')
    Fabricate(:account, username: username, display_name: display_name).tap do |account|
      me.follow!(account)
      account.follow!(me)
    end
  end

  describe 'GET /api/v1/nudges/mates' do
    before do
      mate('ana', 'Ana Banana')
      mate('zed')
      me.follow!(Fabricate(:account, username: 'zara'))
    end

    it 'lists your Mates by username, and nobody you only follow' do
      get '/api/v1/nudges/mates', headers: headers

      expect(response.parsed_body.pluck(:username)).to eq %w(ana zed)
    end

    # The picker held one page and searched inside it, so a Mate past the
    # page could not be found by any search.
    it 'finds a Mate beyond the page by username or display name' do
      get '/api/v1/nudges/mates', headers: headers, params: { limit: 1, q: 'ze' }
      expect(response.parsed_body.pluck(:username)).to eq %w(zed)

      get '/api/v1/nudges/mates', headers: headers, params: { q: 'banana' }
      expect(response.parsed_body.pluck(:username)).to eq %w(ana)

      get '/api/v1/nudges/mates', headers: headers, params: { q: '@ZED' }
      expect(response.parsed_body.pluck(:username)).to eq %w(zed)
    end

    it 'treats a percent sign as a character, not a wildcard' do
      get '/api/v1/nudges/mates', headers: headers, params: { q: '%' }

      expect(response.parsed_body).to be_empty
    end
  end
end
