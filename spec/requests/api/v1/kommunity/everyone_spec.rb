# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Kommunity everyone list' do
  let(:user)    { Fabricate(:user, current_sign_in_at: 1.day.ago) }
  let(:viewer)  { user.account }
  let(:scopes)  { 'read:accounts' }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def member(username, findable: :everyone, display_name: '')
    Fabricate(:account, username: username, display_name: display_name).tap do |account|
      account.user.update!(current_sign_in_at: 1.day.ago)
      account.update!(kommunity_discoverability: findable)
    end
  end

  def mate!(one, other)
    one.follow!(other)
    other.follow!(one)
  end

  def listed
    response.parsed_body.pluck(:username)
  end

  it 'requires a signed-in user' do
    get '/api/v1/kommunity/everyone'

    expect(response).to have_http_status(401)
  end

  describe 'GET /api/v1/kommunity/everyone' do
    let!(:orbit_fof)       { member('orbit_fof', findable: :orbit) }
    let!(:open_mate)       { member('open_mate') }
    let!(:hidden_mate)     { member('hidden_mate', findable: :nobody) }
    let!(:hidden_krewmate) { member('hidden_krewmate', findable: :nobody) }
    let!(:requested)       { member('requested') }
    let!(:blocked)         { member('blocked') }
    let!(:blocker)         { member('blocker') }
    let!(:muted)           { member('muted') }

    before do
      member('open_stranger')
      member('hidden_stranger', findable: :nobody)
      member('orbit_stranger', findable: :orbit)
      Fabricate(:account, username: 'never_signed_in').user.update!(current_sign_in_at: nil)

      mate!(viewer, open_mate)
      mate!(viewer, hidden_mate)
      mate!(open_mate, orbit_fof)

      krew = Krew.create!(slug: 'walkers', name: 'Walkers', access: 'open')
      [viewer, hidden_krewmate].each { |a| KrewMembership.find_or_create_by!(krew: krew, account: a) }

      Mates::RequestService.new.call(viewer, requested)
      viewer.block!(blocked)
      blocker.block!(viewer)
      viewer.mute!(muted)
    end

    it 'lists only people who chose to be visible to the viewer' do
      get '/api/v1/kommunity/everyone', headers: headers

      expect(response).to have_http_status(200)
      expect(listed).to contain_exactly(
        'open_stranger', 'open_mate', 'orbit_fof', 'requested'
      )
    end

    it 'lists a Mate who is findable by everyone' do
      get '/api/v1/kommunity/everyone', headers: headers

      expect(listed).to include('open_mate')
    end

    it 'leaves out a Mate or Krew member who chose nobody' do
      get '/api/v1/kommunity/everyone', headers: headers

      expect(listed).to_not include('hidden_mate', 'hidden_krewmate')
    end

    it 'leaves out the viewer' do
      get '/api/v1/kommunity/everyone', headers: headers

      expect(listed).to_not include(viewer.username)
    end
  end

  describe 'order, search and paging' do
    before do
      member('zed', display_name: 'Aardvark')
      member('bob')
      member('carol', display_name: 'carol')
      member('alfie', findable: :nobody)
    end

    it 'orders by display name, falling back to username' do
      get '/api/v1/kommunity/everyone', headers: headers

      expect(listed).to eq %w(zed bob carol)
    end

    it 'filters by name or handle with q' do
      get '/api/v1/kommunity/everyone', params: { q: 'aard' }, headers: headers
      expect(listed).to eq %w(zed)

      get '/api/v1/kommunity/everyone', params: { q: 'BO' }, headers: headers
      expect(listed).to eq %w(bob)
    end

    it 'pages by offset with a next link' do
      get '/api/v1/kommunity/everyone', params: { limit: 2 }, headers: headers

      expect(listed).to eq %w(zed bob)
      expect(response.headers['Link']).to include('offset=2')

      get '/api/v1/kommunity/everyone', params: { limit: 2, offset: 2 }, headers: headers

      expect(listed).to eq %w(carol)
      expect(response.headers['Link'].to_s).to_not include('rel="next"')
    end
  end
end
