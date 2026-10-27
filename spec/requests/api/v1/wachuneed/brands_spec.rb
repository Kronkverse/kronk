# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/wachuneed.md, Brands.
RSpec.describe 'Wachuneed brands API' do
  let(:user)    { Fabricate(:user) }
  let(:scopes)  { 'read:statuses write:statuses' }
  let(:headers) { headers_for(user) }

  def headers_for(someone)
    token = Fabricate(:accessible_access_token, resource_owner_id: someone.id, scopes: scopes)
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def brand_by(account, name = 'Zorali', **attrs)
    WachuneedBrand.create!(account: account, name: name, url: 'https://zorali.example', why: 'They repair what they sell.', **attrs)
  end

  def back(brand, count)
    Fabricate.times(count, :account).each { |backer| brand.back!(backer) }
  end

  describe 'POST /api/v1/wachuneed/brands' do
    it 'proposes a brand, backed by its proposer' do
      post '/api/v1/wachuneed/brands', headers: headers,
                                       params: { name: 'Pargo', url: 'https://pargo.example', why: 'Fair pay all the way down.', category: 'clothing' }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include(
        'name' => 'Pargo', 'url' => 'https://pargo.example', 'category' => 'clothing',
        'backers_count' => 1, 'backers_to_list' => WachuneedBrand::BACKERS_TO_LIST,
        'listed' => false, 'backed' => true, 'can_edit' => true, 'can_remove' => true
      )
      expect(response.parsed_body['backers'].pluck('id')).to eq [user.account.id.to_s]
    end

    it 'takes a picture from your own uploads only' do
      mine   = Fabricate(:media_attachment, account: user.account, status: nil)
      theirs = Fabricate(:media_attachment, status: nil)

      post '/api/v1/wachuneed/brands', headers: headers,
                                       params: { name: 'Pargo', url: 'https://pargo.example', why: 'Fair pay.', picture_id: mine.id }
      expect(WachuneedBrand.last.media_attachment).to eq mine

      post '/api/v1/wachuneed/brands', headers: headers,
                                       params: { name: 'Other', url: 'https://other.example', why: 'Good.', picture_id: theirs.id }
      expect(WachuneedBrand.last.media_attachment).to be_nil
    end

    it 'needs a reason' do
      post '/api/v1/wachuneed/brands', headers: headers, params: { name: 'Pargo', url: 'https://pargo.example' }

      expect(response).to have_http_status(422)
    end

    it 'refuses an address that is not http or https' do
      post '/api/v1/wachuneed/brands', headers: headers,
                                       params: { name: 'Pargo', url: 'javascript:alert(1)', why: 'Fair pay.' }

      expect(response).to have_http_status(422)
      expect(response.parsed_body['error']).to include('http')
      expect(WachuneedBrand.count).to eq 0
    end

    it 'refuses a brand that is already proposed' do
      brand_by(Fabricate(:account), 'Pargo')

      post '/api/v1/wachuneed/brands', headers: headers,
                                       params: { name: 'pargo', url: 'https://pargo.example', why: 'Fair pay.' }

      expect(response).to have_http_status(422)
    end

    it 'needs a signed-in member' do
      post '/api/v1/wachuneed/brands', params: { name: 'Pargo', url: 'https://pargo.example', why: 'Fair pay.' }

      expect(response).to have_http_status(401)
    end
  end

  describe 'GET /api/v1/wachuneed/brands' do
    before do
      back(brand_by(Fabricate(:account), 'Zorali'), 2)
      back(brand_by(Fabricate(:account), 'Pargo'), 1)
      back(brand_by(Fabricate(:account), 'Alpine Co', category: 'outdoors'), 2)
    end

    it 'lists the brands with the backers they need, A to Z' do
      get '/api/v1/wachuneed/brands', headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck('name')).to eq ['Alpine Co', 'Zorali']
      expect(response.parsed_body.first).to include('backers_count' => 3, 'listed' => true, 'backed' => false, 'can_edit' => false)
      expect(response.parsed_body.first).to_not include('backers')
    end

    it 'lists the ones still gathering backers under proposed' do
      get '/api/v1/wachuneed/brands', headers: headers, params: { status: 'proposed' }

      expect(response.parsed_body.pluck('name')).to eq ['Pargo']
      expect(response.parsed_body.first).to include('backers_count' => 2, 'listed' => false)
    end

    it 'narrows to a category' do
      get '/api/v1/wachuneed/brands', headers: headers, params: { category: 'outdoors' }

      expect(response.parsed_body.pluck('name')).to eq ['Alpine Co']
    end

    it 'leaves out brands proposed by someone who blocks you' do
      WachuneedBrand.find_by(name: 'Zorali').account.block!(user.account)

      get '/api/v1/wachuneed/brands', headers: headers

      expect(response.parsed_body.pluck('name')).to eq ['Alpine Co']
    end
  end

  describe 'GET /api/v1/wachuneed/brands/:id' do
    it 'shows the brand with who proposed it and who backs it' do
      proposer = Fabricate(:account)
      brand = brand_by(proposer)
      back(brand, 1)

      get "/api/v1/wachuneed/brands/#{brand.id}", headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body['account']['id']).to eq proposer.id.to_s
      expect(response.parsed_body['backers'].size).to eq 2
      expect(response.parsed_body['backers'].first['id']).to eq proposer.id.to_s
    end

    it 'is not found for someone the proposer blocks' do
      brand = brand_by(Fabricate(:account))
      brand.account.block!(user.account)

      get "/api/v1/wachuneed/brands/#{brand.id}", headers: headers

      expect(response).to have_http_status(404)
    end
  end

  describe 'backing' do
    let(:proposer) { Fabricate(:user) }
    let(:brand)    { brand_by(proposer.account) }

    it 'backs a brand once, and takes the backing back' do
      2.times { post "/api/v1/wachuneed/brands/#{brand.id}/backing", headers: headers }

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('backers_count' => 2, 'backed' => true)

      delete "/api/v1/wachuneed/brands/#{brand.id}/backing", headers: headers

      expect(response).to have_http_status(200)
      expect(response.parsed_body).to include('backers_count' => 1, 'backed' => false)
    end

    it 'lists the brand, and nudges its proposer, once it has the backers it needs' do
      back(brand, 1)

      expect { post "/api/v1/wachuneed/brands/#{brand.id}/backing", headers: headers }
        .to change { Nudges::Event.where(verb: 'brand_listed', source_type: 'WachuneedBrand', source_id: brand.id).count }.by(1)
      expect(response.parsed_body).to include('listed' => true)

      get '/api/v1/wachuneed/brands', headers: headers
      expect(response.parsed_body.pluck('id')).to include(brand.id.to_s)
    end

    it 'does not let the proposer back it again or take theirs back' do
      post "/api/v1/wachuneed/brands/#{brand.id}/backing", headers: headers_for(proposer)
      expect(response).to have_http_status(403)

      delete "/api/v1/wachuneed/brands/#{brand.id}/backing", headers: headers_for(proposer)
      expect(response).to have_http_status(422)
      expect(brand.reload.backers_count).to eq 1
    end
  end

  describe 'PATCH /api/v1/wachuneed/brands/:id' do
    let(:brand) { brand_by(user.account) }

    it 'lets the proposer edit it' do
      patch "/api/v1/wachuneed/brands/#{brand.id}", headers: headers, params: { why: 'Repairs for life.', category: 'outdoors' }

      expect(response).to have_http_status(200)
      expect(brand.reload).to have_attributes(why: 'Repairs for life.', category: 'outdoors')
    end

    it 'keeps the address a web address' do
      patch "/api/v1/wachuneed/brands/#{brand.id}", headers: headers, params: { url: 'ftp://zorali.example' }

      expect(response).to have_http_status(422)
      expect(brand.reload.url).to eq 'https://zorali.example'
    end

    it 'is refused to anyone else' do
      other = Fabricate(:user)

      patch "/api/v1/wachuneed/brands/#{brand.id}", headers: headers_for(other), params: { why: 'Mine now.' }

      expect(response).to have_http_status(403)
      expect(brand.reload.why).to eq 'They repair what they sell.'
    end
  end

  describe 'DELETE /api/v1/wachuneed/brands/:id' do
    let(:brand) { brand_by(user.account).tap { |b| back(b, 1) } }

    it 'lets the proposer take it down, backings and all' do
      delete "/api/v1/wachuneed/brands/#{brand.id}", headers: headers

      expect(response).to have_http_status(200)
      expect(WachuneedBrand.exists?(brand.id)).to be false
      expect(WachuneedBrandBacking.where(wachuneed_brand_id: brand.id)).to be_empty
    end

    it 'is refused to another member' do
      delete "/api/v1/wachuneed/brands/#{brand.id}", headers: headers_for(Fabricate(:user))

      expect(response).to have_http_status(403)
      expect(WachuneedBrand.exists?(brand.id)).to be true
    end

    it 'lets staff who handle reports take it down' do
      delete "/api/v1/wachuneed/brands/#{brand.id}", headers: headers_for(Fabricate(:moderator_user))

      expect(response).to have_http_status(200)
      expect(WachuneedBrand.exists?(brand.id)).to be false
    end
  end
end
