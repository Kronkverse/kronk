# frozen_string_literal: true

require 'rails_helper'

PEOPLE_AUDIENCE_KORNERS = {
  'cinema' => { path: '/api/v1/cinema/films', make: ->(owner, reach) { Film.create!(owner: owner, title: 'Harvest film', visibility: reach) } },
  'karporn' => { path: '/api/v1/karporn/kars', make: ->(owner, reach) { Kar.create!(owner: owner, title: 'Ute', make: 'Holden', model: 'Kingswood', year: 1976, visibility: reach) } },
  'kronikles' => { path: '/api/v1/kronikles/chronicles', make: ->(owner, reach) { Chronicle.create!(owner: owner, title: 'Harvest story', body: 'It rained.', visibility: reach) } },
  'art' => { path: '/api/v1/art/pieces', make: ->(owner, reach) { ArtPiece.create!(owner: owner, title: 'Harvest print', visibility: reach) } },
  'wachuneed' => { path: '/api/v1/wachuneed/listings', make: ->(owner, reach) { Listing.create!(account: owner, title: 'Seedlings', category: 'goods', state: 'live', visibility: reach) } },
}.freeze

# Films, kars, kronikles, art pieces and listings can be for, or kept from,
# people by name on top of their reach and Krews, as a post can
# (Kronk::PeopleAudience, decisions.md 2026-11-19).
RSpec.describe 'People audiences on films, kars, kronikles, art and listings' do
  let(:author)   { Fabricate(:user) }
  let(:friend)   { Fabricate(:user) }
  let(:mate)     { Fabricate(:user) }
  let(:stranger) { Fabricate(:user) }

  before do
    Kronk::KornerRegistry.reload!
    author.account.follow!(mate.account)
    mate.account.follow!(author.account)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def ids_listed(path, user)
    get path, headers: headers_for(user)
    response.parsed_body.pluck('id')
  end

  PEOPLE_AUDIENCE_KORNERS.each do |slug, korner|
    context "with #{slug}" do
      it 'is seen by someone added to a Just me one, and nobody else' do
        record = korner[:make].call(author.account, :self_only)
        record.sync_audience_people!(added: [friend.account.id], removed: [])

        expect(record.visible_to?(friend.account)).to be(true)
        expect(ids_listed(korner[:path], friend)).to include(record.id.to_s)
        expect(record.visible_to?(stranger.account)).to be(false)
        expect(ids_listed(korner[:path], stranger)).to_not include(record.id.to_s)
      end

      it 'keeps out a Mate kept out of a Mates one' do
        record = korner[:make].call(author.account, :mates)
        expect(record.visible_to?(mate.account)).to be(true)

        record.sync_audience_people!(added: [], removed: [mate.account.id])

        expect(record.visible_to?(mate.account)).to be(false)
        expect(ids_listed(korner[:path], mate)).to_not include(record.id.to_s)
        expect(record.visible_to?(author.account)).to be(true)
      end

      it 'tells the owner who it is for, and nobody else' do
        record = korner[:make].call(author.account, :self_only)
        record.sync_audience_people!(added: [friend.account.id], removed: [mate.account.id])

        get "#{korner[:path]}/#{record.id}", headers: headers_for(author)
        expect(response.parsed_body.dig('audience_people', 'added').pluck('id')).to eq([friend.account.id.to_s])
        expect(response.parsed_body.dig('audience_people', 'removed').pluck('id')).to eq([mate.account.id.to_s])

        get "#{korner[:path]}/#{record.id}", headers: headers_for(friend)
        expect(response.parsed_body['audience_people']).to be_nil
      end
    end
  end

  it 'carries no people on a Kronkverse record' do
    film = PEOPLE_AUDIENCE_KORNERS['cinema'][:make].call(author.account, :public)
    film.sync_audience_people!(added: [friend.account.id], removed: [mate.account.id])

    expect(film.record_people).to be_empty
    expect(film.visible_to?(mate.account)).to be(true)
  end

  it 'drops its people when an edit makes it Kronkverse' do
    kar = PEOPLE_AUDIENCE_KORNERS['karporn'][:make].call(author.account, :mates)
    kar.sync_audience_people!(added: [], removed: [mate.account.id])

    put "/api/v1/karporn/kars/#{kar.id}", headers: headers_for(author), params: { kar: { visibility: 'public' } }

    expect(kar.reload.record_people).to be_empty
    expect(kar.visible_to?(mate.account)).to be(true)
  end

  it 'takes people from the composer and puts them on the feed post' do
    post '/api/v1/wachuneed/listings', headers: headers_for(author), params: {
      title: 'Seedlings', category: 'goods', state: 'live', visibility: 'self_only', audience_grant_ids: [friend.account.id]
    }
    listing = Listing.find(response.parsed_body['id'])

    expect(listing.audience_added_ids).to eq([friend.account.id])
    expect(listing.status.granted_accounts.pluck(:id)).to eq([friend.account.id])
    expect(StatusPolicy.new(friend.account, listing.status).show?).to be(true)
    expect(StatusPolicy.new(stranger.account, listing.status).show?).to be(false)

    put "/api/v1/wachuneed/listings/#{listing.id}", headers: headers_for(author), params: { audience_grant_ids: [], audience_exclude_ids: [] }
    expect(listing.reload.record_people).to be_empty
    expect(listing.status.granted_accounts).to be_empty
  end

  it 'keeps the people when an edit sends none' do
    chronicle = PEOPLE_AUDIENCE_KORNERS['kronikles'][:make].call(author.account, :self_only)
    chronicle.sync_audience_people!(added: [friend.account.id], removed: [])

    put "/api/v1/kronikles/chronicles/#{chronicle.id}", headers: headers_for(author), params: { chronicle: { title: 'Harvest' } }

    expect(chronicle.reload.audience_added_ids).to eq([friend.account.id])
  end
end
