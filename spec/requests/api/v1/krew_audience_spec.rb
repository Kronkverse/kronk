# frozen_string_literal: true

require 'rails_helper'

KREW_AUDIENCE_KORNERS = {
  'cinema' => { path: '/api/v1/cinema/films', make: ->(owner) { Film.create!(owner: owner, title: 'Harvest film', visibility: :self_only) } },
  'karporn' => { path: '/api/v1/karporn/kars', make: ->(owner) { Kar.create!(owner: owner, title: 'Ute', make: 'Holden', model: 'Kingswood', year: 1976, visibility: :self_only) } },
  'kronikles' => { path: '/api/v1/kronikles/chronicles', make: ->(owner) { Chronicle.create!(owner: owner, title: 'Harvest story', body: 'It rained.', visibility: :self_only) } },
  'art' => { path: '/api/v1/art/pieces', make: ->(owner) { ArtPiece.create!(owner: owner, title: 'Harvest print', visibility: :self_only) } },
  'wachuneed' => { path: '/api/v1/wachuneed/listings', make: ->(owner) { Listing.create!(account: owner, title: 'Seedlings', category: 'goods', state: 'live', visibility: :self_only) } },
}.freeze

# Films, kars, kronikles, art pieces and listings can be for a Krew, on top
# of their reach, as albums are (Kronk::KrewAudience, decisions.md
# 2026-10-25).
RSpec.describe 'Krew audiences on films, kars, kronikles, art and listings' do
  let(:author)   { Fabricate(:user) }
  let(:member)   { Fabricate(:user) }
  let(:stranger) { Fabricate(:user) }
  let(:growers)  { Krew.create!(slug: 'growers', name: 'Growers', access: 'open') }
  let(:weavers)  { Krew.create!(slug: 'weavers', name: 'Weavers', access: 'open') }

  before do
    Kronk::KornerRegistry.reload!
    [growers, weavers].each { |krew| krew.krew_memberships.create!(account: author.account) }
    growers.krew_memberships.create!(account: member.account)
  end

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def ids_listed(path, user)
    get path, headers: headers_for(user)
    response.parsed_body.pluck('id')
  end

  KREW_AUDIENCE_KORNERS.each do |slug, korner|
    context "with #{slug}" do
      let(:record) { korner[:make].call(author.account).tap { |r| r.sync_audience_krews!([growers.id]) } }

      it 'is seen by members of its Krew and nobody else' do
        get "#{korner[:path]}/#{record.id}", headers: headers_for(member)
        expect(response).to have_http_status(200)
        expect(response.parsed_body['krews'].pluck('id')).to eq([growers.id.to_s])
        expect(ids_listed(korner[:path], member)).to include(record.id.to_s)

        get "#{korner[:path]}/#{record.id}", headers: headers_for(stranger)
        expect(response.status).to be_in([403, 404])
        expect(ids_listed(korner[:path], stranger)).to_not include(record.id.to_s)
      end

      it "takes a Growers-only event's audience and follows it" do
        plain = korner[:make].call(author.account)
        plain.update!(visibility: :public)
        post '/api/v1/events', headers: headers_for(author), params: { title: 'Harvest', start_time: 2.days.from_now.iso8601, visibility: 'self_only', krew_ids: [growers.id] }
        event = Event.find(response.parsed_body['id'])

        post '/api/v1/attachments', headers: headers_for(author), params: {
          source_slug: slug, source_id: plain.id, target_slug: 'kalendar', target_id: event.id, kind: 'link', metadata: { audience: 'same' }
        }
        expect(response).to have_http_status(200)
        expect(Kronk::Audience.read(plain.reload)).to eq(tier: 'self_only', krew_ids: [growers.id])
        expect(plain.visible_to?(member.account)).to be(true)
        expect(plain.visible_to?(stranger.account)).to be(false)

        Kronk::EventLinks.link!(event, weavers, author.account)
        expect(Kronk::Audience.read(plain.reload)[:krew_ids]).to eq([growers.id, weavers.id].sort)
      end

      it 'is for a Krew it is Konnected to by its owner, and Konnected to the Krews it is for' do
        expect(Kronk::AttachmentEffects.between(slug, record.id, 'krew', growers.id).exists?).to be(true)

        post '/api/v1/attachments', headers: headers_for(author), params: { source_slug: slug, source_id: record.id, target_slug: 'krew', target_id: weavers.id, kind: 'link' }
        expect(record.reload.krew_ids).to contain_exactly(growers.id, weavers.id)

        delete "/api/v1/attachments/#{response.parsed_body['id']}", headers: headers_for(author)
        expect(record.reload.krew_ids).to eq([growers.id])
      end
    end
  end

  it 'takes krew_ids from the composer, as albums do, and puts them on the feed post' do
    post '/api/v1/kronikles/chronicles', headers: headers_for(author), params: {
      chronicle: { title: 'Harvest story', body: 'It rained.', kind: 'essay', visibility: 'self_only' }, krew_ids: [growers.id, Krew.create!(slug: 'others', name: 'Others', access: 'open').id]
    }

    expect(response).to have_http_status(201)
    expect(response.parsed_body['krews'].pluck('id')).to eq([growers.id.to_s])
    chronicle = Chronicle.find(response.parsed_body['id'])
    expect(chronicle.status.krews.pluck(:id)).to eq([growers.id])

    put "/api/v1/kronikles/chronicles/#{chronicle.id}", headers: headers_for(author), params: { chronicle: { title: 'Harvest story' }, krew_ids: [] }
    expect(chronicle.reload.krew_ids).to be_empty
    expect(chronicle.status.krews).to be_empty
  end

  it 'keeps the Krews when an edit sends none' do
    kar = KREW_AUDIENCE_KORNERS['karporn'][:make].call(author.account)
    kar.sync_audience_krews!([growers.id])
    put "/api/v1/karporn/kars/#{kar.id}", headers: headers_for(author), params: { kar: { title: 'Red ute' } }

    expect(kar.reload.krew_ids).to eq([growers.id])
  end

  it 'gives a listing its Krews on create and in its detail' do
    post '/api/v1/wachuneed/listings', headers: headers_for(author), params: { title: 'Seedlings', category: 'goods', state: 'live', visibility: 'self_only', krew_ids: [growers.id] }
    listing = Listing.find(response.parsed_body['id'])

    expect(listing.krew_ids).to eq([growers.id])
    expect(listing.status.krews.pluck(:id)).to eq([growers.id])
    get "/api/v1/wachuneed/listings/#{listing.id}", headers: headers_for(member)
    expect(response.parsed_body['krews'].pluck('id')).to eq([growers.id.to_s])
  end
end
