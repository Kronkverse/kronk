# frozen_string_literal: true

require 'rails_helper'

# Whoever asked a Kuestion can delete it (Tal, 2026-11-08; docs/spaces/
# kuestions.md, Deleting one). Its answers and its feed post go with it.
RSpec.describe 'Deleting a Kuestion' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read write') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:other)   { Fabricate(:account) }

  it 'deletes your own, with its answers and its feed post', :aggregate_failures do
    question = Question.create!(title: 'Best walk nearby?', created_by_account: user.account)
    status = Fabricate(:status, account: user.account, text: 'Best walk nearby?')
    question.update!(status: status)
    Answer.create!(question: question, account: other, body: 'The canal')

    delete "/api/v2/kuestions/#{question.id}", headers: headers

    expect(response).to have_http_status(200)
    expect(Question.find_by(id: question.id)).to be_nil
    expect(Answer.where(question_id: question.id)).to be_empty
    expect(Status.find_by(id: status.id)).to be_nil
  end

  it 'deletes one you asked in your Krew' do
    krew = Krew.create!(slug: 'growers', name: 'Growers', access: 'open', seeded_by: other, last_activity_at: Time.current)
    krew.krew_memberships.create!(account: user.account, role: 'member', source: 'direct')
    question = Question.create!(title: 'Which weekend?', created_by_account: user.account, krew: krew)

    delete "/api/v2/kuestions/#{question.id}", headers: headers

    expect(response).to have_http_status(200)
    expect(Question.find_by(id: question.id)).to be_nil
  end

  it "refuses someone else's" do
    question = Question.create!(title: 'Tea or coffee?', created_by_account: other)

    delete "/api/v2/kuestions/#{question.id}", headers: headers

    expect(response).to have_http_status(403)
    expect(Question.find_by(id: question.id)).to be_present
  end

  it 'refuses a profile Kuestion, whose answers are on other profiles' do
    question = Question.create!(title: 'Where did you grow up?', created_by_account: user.account, kind: 'profile')

    delete "/api/v2/kuestions/#{question.id}", headers: headers

    expect(response).to have_http_status(403)
  end

  it "is a 404 for a Krew's Kuestion you can't see" do
    krew = Krew.create!(slug: 'quiet', name: 'Quiet', access: 'open', seeded_by: other, last_activity_at: Time.current)
    question = Question.create!(title: 'Private?', created_by_account: other, krew: krew)

    delete "/api/v2/kuestions/#{question.id}", headers: headers

    expect(response).to have_http_status(404)
  end
end
