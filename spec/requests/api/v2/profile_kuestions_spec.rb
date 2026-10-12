# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Profile Kuestions' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }

  let(:viewer)         { Fabricate(:user) }
  let(:viewer_token)   { Fabricate(:accessible_access_token, resource_owner_id: viewer.id, scopes: 'read') }
  let(:viewer_headers) { { 'Authorization' => "Bearer #{viewer_token.token}" } }

  before { Kuestions::ProfileSeeds.sync! }

  def seeded(key)
    Question.find_by!(seed_key: key)
  end

  def answer(question, params = {})
    post "/api/v2/kuestions/#{question.id}/answers", params: params, headers: headers
  end

  describe 'Kuestions::ProfileSeeds.sync!' do
    it 'loads every seed once, as unlocked profile Kuestions without an author' do
      expect { Kuestions::ProfileSeeds.sync! }.to_not change(Question, :count)
      expect(Question.profile.count).to eq Kuestions::ProfileSeeds.entries.size
      expect(seeded('birthday')).to have_attributes(answer_format: 'date', locked: false, created_by_account_id: nil)
    end
  end

  describe 'GET /api/v2/kuestions?filter=profile' do
    it 'lists profile Kuestions in seed order, with the viewer answer, and keeps them out of the deck' do
      answer(seeded('location'), body: 'Sydney')

      get '/api/v2/kuestions', params: { filter: 'profile' }, headers: headers

      expect(response).to have_http_status(200)
      keys = response.parsed_body.pluck(:seed_key)
      expect(keys.first(2)).to eq %w(pronouns location)
      location = response.parsed_body.find { |q| q[:seed_key] == 'location' }
      expect(location).to include(label: 'Location', group: 'Basics', my_answer: include(body: 'Sydney', pinned: true, visibility_scope: 'public'))

      get '/api/v2/kuestions', headers: headers
      expect(response.parsed_body.pluck(:kind).uniq).to_not include('profile')
    end
  end

  describe 'POST /api/v2/kuestions/:id/answers on a profile Kuestion' do
    it 'pins the answer and makes no feed post' do
      expect { answer(seeded('pronouns'), body: 'she / her') }.to_not change(Status, :count)

      expect(response).to have_http_status(201)
      expect(Answer.find_by(account: user.account)).to be_pinned
      expect(response.parsed_body[:my_answer]).to include(body: 'she / her', pinned: true)
    end

    it 'rejects a date that is not YYYY-MM-DD' do
      answer(seeded('birthday'), body: '12 March')

      expect(response).to have_http_status(422)
    end
  end

  describe 'PATCH /api/v2/kuestions/:id/answer' do
    let(:question) { seeded('status') }

    before { answer(question, body: 'Building things') }

    it 'edits without keeping a trail, resizes and unpins' do
      patch "/api/v2/kuestions/#{question.id}/answer", params: { body: 'Resting', size: 'l', pinned: false }, headers: headers

      expect(response).to have_http_status(200)
      mine = Answer.find_by(question: question, account: user.account)
      expect(mine).to have_attributes(body: 'Resting', edit_history: [], pinned_at: nil)
      expect(mine.size).to eq 'l'
    end
  end

  describe 'DELETE /api/v2/kuestions/:id/answer' do
    it 'removes a profile answer' do
      answer(seeded('height'), body: 'Tall')

      expect { delete "/api/v2/kuestions/#{seeded('height').id}/answer", headers: headers }
        .to change(Answer, :count).by(-1)
    end

    it 'keeps a community answer' do
      community = Question.create!(title: 'Tea?', created_by_account: Fabricate(:account), locked: true)
      answer(community, body: 'Yes')

      delete "/api/v2/kuestions/#{community.id}/answer", headers: headers

      expect(response).to have_http_status(422)
      expect(Answer.where(question: community)).to exist
    end
  end

  describe 'GET /api/v2/kuestions/pinned' do
    before do
      answer(seeded('location'), body: 'Sydney', visibility_scope: 'public')
      answer(seeded('pronouns'), body: 'she / her', visibility_scope: 'mates')
      answer(seeded('fun_fact'), body: 'Secret', visibility_scope: 'self_only')
    end

    it 'shows the owner everything, in their order' do
      patch '/api/v2/kuestions/pinned', params: { question_ids: [seeded('fun_fact').id, seeded('location').id, seeded('pronouns').id] }, headers: headers
      get '/api/v2/kuestions/pinned', params: { account_id: user.account.id }, headers: headers

      expect(response.parsed_body.pluck(:seed_key)).to eq %w(fun_fact location pronouns)
    end

    it 'shows another member only what each answer reaches' do
      get '/api/v2/kuestions/pinned', params: { account_id: user.account.id }, headers: viewer_headers

      expect(response.parsed_body.pluck(:seed_key)).to eq %w(location)
    end
  end

  describe 'POST /api/v2/kuestions with kind=profile' do
    it 'makes an unlocked profile Kuestion with no feed post' do
      expect { post '/api/v2/kuestions', params: { title: 'Favourite tree?', kind: 'profile', answer_format: 'list' }, headers: headers }
        .to_not change(Status, :count)

      expect(response).to have_http_status(201)
      expect(Question.last).to have_attributes(kind: 'profile', locked: false, answer_format: 'list')
    end

    it 'keeps the profile-only formats out of community Kuestions' do
      post '/api/v2/kuestions', params: { title: 'Favourite tree?', answer_format: 'list' }, headers: headers

      expect(response).to have_http_status(422)
    end
  end
end
