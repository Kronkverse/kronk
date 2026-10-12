# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Kommunity discover layers' do
  let(:user)    { Fabricate(:user, current_sign_in_at: 1.day.ago) }
  let(:scopes)  { 'read:accounts' }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: scopes) }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  def member(username)
    Fabricate(:account, username: username).tap { |account| account.user.update!(current_sign_in_at: 1.day.ago) }
  end

  def listed
    response.parsed_body.pluck(:username)
  end

  describe 'GET /api/v1/kommunity/kronkers' do
    let!(:stranger)  { member('stranger') }
    let!(:requested) { member('requested') }
    let!(:asker)     { member('asker') }
    let!(:mate)      { member('mate') }

    before do
      [stranger, requested, asker, mate].each { |a| a.update!(kommunity_discoverability: :everyone) }
      Mates::RequestService.new.call(user.account, requested)
      Mates::RequestService.new.call(asker, user.account)
      user.account.follow!(mate)
      mate.follow!(user.account)
    end

    it 'leaves out Mates and people you have already asked, and keeps people who asked you' do
      get '/api/v1/kommunity/kronkers', headers: headers

      expect(response).to have_http_status(200)
      expect(listed).to contain_exactly('stranger', 'asker')
    end
  end

  describe 'GET /api/v1/kommunity/krews' do
    let!(:krewmate)  { member('krewmate') }
    let!(:requested) { member('requested') }

    before do
      krew = Krew.create!(slug: 'walkers', name: 'Walkers', access: 'open')
      [user.account, krewmate, requested].each { |a| KrewMembership.find_or_create_by!(krew: krew, account: a) }
      Mates::RequestService.new.call(user.account, requested)
    end

    it 'leaves out a krew member you have already asked' do
      get '/api/v1/kommunity/krews', headers: headers

      expect(response).to have_http_status(200)
      expect(listed).to contain_exactly('krewmate')
    end
  end
end
