# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Kuestions' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:other)   { Fabricate(:account) }

  describe 'GET /api/v2/kuestions?filter=involved' do
    let!(:answered) { Question.create!(title: 'Tea or coffee?', created_by_account: other) }
    let!(:asked)    { Question.create!(title: 'Best walk nearby?', created_by_account: user.account) }
    let!(:untouched) { Question.create!(title: 'Favourite film?', created_by_account: other) }

    before do
      Answer.create!(question: answered, account: user.account, body: 'Tea')
    end

    it 'lists what the viewer answered and asked, with their own answer' do
      get '/api/v2/kuestions', params: { filter: 'involved' }, headers: headers

      expect(response).to have_http_status(200)
      rows = response.parsed_body.index_by { |q| q[:id] }
      expect(rows.keys).to contain_exactly(answered.id.to_s, asked.id.to_s)
      expect(rows.keys).to_not include(untouched.id.to_s)
      expect(rows[answered.id.to_s]).to include(asked_by_me: false, my_answer: include(body: 'Tea'))
      expect(rows[asked.id.to_s]).to include(asked_by_me: true, my_answer: nil)
    end

    it 'counts the answers that came in since the viewer last opened each one' do
      travel_to(1.hour.from_now) do
        Answer.create!(question: answered, account: other, body: 'Coffee')
        Answer.create!(question: asked, account: other, body: 'The canal')
        Answer.create!(question: asked, account: Fabricate(:account), body: 'The hill')
      end

      travel_to(2.hours.from_now) do
        get '/api/v2/kuestions', params: { filter: 'involved' }, headers: headers
      end

      rows = response.parsed_body.index_by { |q| q[:id] }
      expect(rows[answered.id.to_s]).to include(new_answers_count: 1)
      expect(rows[asked.id.to_s]).to include(new_answers_count: 2)
    end
  end

  describe 'POST /api/v2/kuestions/:id/seen' do
    let(:token) { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
    let!(:asked) { Question.create!(title: 'Best walk nearby?', created_by_account: user.account) }

    it 'stops the answers there now counting as new' do
      travel_to(1.hour.from_now) { Answer.create!(question: asked, account: other, body: 'The canal') }

      travel_to(2.hours.from_now) do
        post "/api/v2/kuestions/#{asked.id}/seen", headers: headers
        expect(response).to have_http_status(204)

        get '/api/v2/kuestions', params: { filter: 'involved' }, headers: headers
      end

      expect(response.parsed_body.first).to include(new_answers_count: 0)
    end
  end
end
