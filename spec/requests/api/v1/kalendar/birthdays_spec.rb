# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Kalendar birthdays' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'read') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:mate)    { Fabricate(:account) }
  let(:soon)    { 3.days.from_now.to_date }

  before do
    Kuestions::ProfileSeeds.sync!
    user.account.follow!(mate)
    mate.follow!(user.account)
  end

  def birthday!(account, scope: 'mates', pinned: true)
    question = Question.find_by!(seed_key: 'birthday')
    answer = Answer.create!(question: question, account: account, body: soon.change(year: 1992).iso8601, visibility_scope: scope)
    answer.pin! if pinned
  end

  it "lists a mate's pinned birthday answer" do
    birthday!(mate)

    get '/api/v1/kalendar/birthdays', headers: headers

    expect(response).to have_http_status(200)
    expect(response.parsed_body.first).to include(date: soon.iso8601, days_until: 3)
  end

  it 'leaves out a birthday that is unpinned or kept to themselves' do
    birthday!(mate, pinned: false)
    get '/api/v1/kalendar/birthdays', headers: headers
    expect(response.parsed_body).to be_empty

    Answer.destroy_all
    birthday!(mate, scope: 'self_only')
    get '/api/v1/kalendar/birthdays', headers: headers
    expect(response.parsed_body).to be_empty
  end
end
