# frozen_string_literal: true

require 'rails_helper'

# Kuestions asked in a Krew or a projekt are its own (docs/spaces/kuestions.md,
# Kuestions in a Krew).
RSpec.describe 'Kuestions in a Krew or projekt' do
  let(:member)   { Fabricate(:user) }
  let(:outsider) { Fabricate(:user) }
  let(:krew)     { Fabricate(:krew, seeded_by: member.account, access: 'invite_only') }

  def headers_for(user)
    token = Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write')
    { 'Authorization' => "Bearer #{token.token}" }
  end

  def ask(user, **params)
    post '/api/v2/kuestions', params: { title: 'Who brings the generator?', answer_format: 'text' }.merge(params), headers: headers_for(user)
  end

  # Asks with the jobs run inline (:inline_jobs), so the feed post has
  # reached its feeds.
  def ask_and_deliver(user, **params)
    allow(redis).to receive(:publish)
    ask(user, **params)
    Question.find(response.parsed_body[:id])
  end

  # Only recently active accounts get home feeds.
  def active_user
    Fabricate(:user, current_sign_in_at: Time.now.utc)
  end

  def home_feed(user)
    HomeFeed.new(user.account).get(20).map(&:id)
  end

  describe 'asking in a Krew' do
    it 'keeps it in the Krew', :aggregate_failures do
      ask(member, krew_id: krew.id)

      expect(response).to have_http_status(201)
      question = Question.find(response.parsed_body[:id])
      expect(question.krew).to eq krew
      expect(response.parsed_body[:home]).to include(kind: 'krew', id: krew.id.to_s, name: krew.name)
    end

    it "reaches its members' feeds and no one else's", :aggregate_failures, :inline_jobs do
      other = active_user
      outsider.update!(current_sign_in_at: Time.now.utc)
      krew.krew_memberships.create!(account: other.account, role: 'member', source: 'direct')

      question = ask_and_deliver(member, krew_id: krew.id)

      expect(question.status.visibility).to eq 'self_only'
      expect(home_feed(other)).to include(question.status_id)
      expect(home_feed(outsider)).to_not include(question.status_id)
      expect(StatusPolicy.new(outsider.account, question.status).show?).to be false
    end

    it 'is only for its members' do
      ask(outsider, krew_id: krew.id)

      expect(response).to have_http_status(403)
    end
  end

  describe 'a Krew Kuestion' do
    let!(:question) { Question.create!(title: 'Who brings the generator?', created_by_account: member.account, krew: krew, locked: true) }
    let!(:everyones) { Question.create!(title: 'Tea or coffee?', created_by_account: member.account, locked: true) }

    it 'is listed on the Krew for its members, with their answer', :aggregate_failures do
      Answer.create!(question: question, account: member.account, body: 'Me')

      get '/api/v2/kuestions', params: { krew_id: krew.id }, headers: headers_for(member)

      expect(response).to have_http_status(200)
      expect(response.parsed_body.pluck(:id)).to eq [question.id.to_s]
      expect(response.parsed_body.first).to include(my_answer: include(body: 'Me'))
    end

    it 'is not listed for anyone else' do
      get '/api/v2/kuestions', params: { krew_id: krew.id }, headers: headers_for(outsider)

      expect(response).to have_http_status(404)
    end

    it 'stays out of the deck, for members too' do
      get '/api/v2/kuestions', headers: headers_for(member)

      expect(response.parsed_body.pluck(:id)).to eq [everyones.id.to_s]
    end

    it 'opens and takes answers from members', :aggregate_failures do
      get "/api/v2/kuestions/#{question.id}", headers: headers_for(member)
      expect(response).to have_http_status(200)

      post "/api/v2/kuestions/#{question.id}/answers", params: { body: 'I will' }, headers: headers_for(member)
      expect(response).to have_http_status(201)
    end

    it 'does not open, take answers or skips from anyone else', :aggregate_failures do
      get "/api/v2/kuestions/#{question.id}", headers: headers_for(outsider)
      expect(response).to have_http_status(404)

      post "/api/v2/kuestions/#{question.id}/answers", params: { body: 'Me' }, headers: headers_for(outsider)
      expect(response).to have_http_status(404)

      post "/api/v2/kuestions/#{question.id}/skip", headers: headers_for(outsider)
      expect(response).to have_http_status(404)
      expect(question.answers).to be_empty
    end

    # Tal, 2026-11-09: everyone in the Krew sees the answers, answered or not.
    it 'shows every answer to a member who has not answered', :aggregate_failures do
      other = Fabricate(:user)
      krew.krew_memberships.create!(account: other.account, role: 'member', source: 'direct')
      Answer.create!(question: question, account: member.account, body: 'Me')

      get "/api/v2/kuestions/#{question.id}", headers: headers_for(other)

      expect(response).to have_http_status(200)
      expect(response.parsed_body[:answers].pluck(:body)).to eq ['Me']
    end

    it 'leaves Answered once you leave the Krew', :aggregate_failures do
      Answer.create!(question: question, account: outsider.account, body: 'Me')

      get '/api/v2/kuestions', params: { filter: 'involved' }, headers: headers_for(outsider)

      expect(response.parsed_body.pluck(:id)).to_not include(question.id.to_s)
    end

    it 'goes with its Krew' do
      krew.destroy!

      expect(Question.exists?(question.id)).to be false
    end
  end

  describe 'a projekt Kuestion' do
    let(:open_krew) { Fabricate(:krew, seeded_by: member.account, access: 'open') }
    let(:hidden) { Freethedream::Project.create!(title: 'Doof', owner: member.account, krew: krew) }
    let(:listed) { Freethedream::Project.create!(title: 'Garden', owner: member.account, krew: open_krew) }

    it 'is asked by its members' do
      ask(member, project_id: listed.id)

      expect(Question.find(response.parsed_body[:id]).freethedream_project).to eq listed
    end

    # Joining a Krew joins its projekts (KrewMembership#join_emergence), so
    # its members are in; someone who can only see the projekt is not.
    it "reaches the projekt's members, not everyone who can see it", :aggregate_failures, :inline_jobs do
      joined = active_user
      listed.memberships.create!(account: joined.account, state: :member)
      outsider.update!(current_sign_in_at: Time.now.utc)
      question = ask_and_deliver(member, project_id: listed.id)

      expect(home_feed(joined)).to include(question.status_id)
      expect(listed.visible_to?(outsider.account)).to be true
      expect(home_feed(outsider)).to_not include(question.status_id)
    end

    it 'is not asked by someone outside it' do
      ask(outsider, project_id: listed.id)

      expect(response).to have_http_status(403)
    end

    it 'is seen and answered by whoever can see the projekt', :aggregate_failures do
      question = Question.create!(title: 'Which day?', created_by_account: member.account, freethedream_project: listed, locked: true)

      get '/api/v2/kuestions', params: { project_id: listed.id }, headers: headers_for(outsider)
      expect(response.parsed_body.pluck(:id)).to eq [question.id.to_s]

      post "/api/v2/kuestions/#{question.id}/answers", params: { body: 'Saturday' }, headers: headers_for(outsider)
      expect(response).to have_http_status(201)
    end

    it 'is hidden with its projekt', :aggregate_failures do
      question = Question.create!(title: 'Which day?', created_by_account: member.account, freethedream_project: hidden, locked: true)

      get '/api/v2/kuestions', params: { project_id: hidden.id }, headers: headers_for(outsider)
      expect(response).to have_http_status(404)

      get "/api/v2/kuestions/#{question.id}", headers: headers_for(outsider)
      expect(response).to have_http_status(404)
    end
  end
end
