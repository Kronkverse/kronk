# frozen_string_literal: true

require 'rails_helper'

# A Kuestion is answered, not commented on (Tal's proposal "Kuestions",
# 2026-11-18): its post takes no replies, however the reply is sent.
RSpec.describe 'Replies to a Kuestion' do
  let(:user)    { Fabricate(:user) }
  let(:token)   { Fabricate(:accessible_access_token, resource_owner_id: user.id, scopes: 'write:statuses') }
  let(:headers) { { 'Authorization' => "Bearer #{token.token}" } }
  let(:asker)   { Fabricate(:account) }
  let(:question) { Kuestions::PublishQuestion.new(Question.create!(title: 'Tea or coffee?', created_by_account: asker)).call }

  it 'refuses a reply to the Kuestion post' do
    post '/api/v1/statuses', params: { status: 'Tea, obviously', in_reply_to_id: question.status_id }, headers: headers

    expect(response).to have_http_status(422)
    expect(Status.where(in_reply_to_id: question.status_id)).to be_empty
  end

  it 'refuses a reply further down a comment left before the change' do
    old_comment = Fabricate(:status, account: asker, thread: question.status, text: 'An old comment')

    post '/api/v1/statuses', params: { status: 'Coffee', in_reply_to_id: old_comment.id }, headers: headers

    expect(response).to have_http_status(422)
  end

  it 'still takes replies to an ordinary post' do
    ordinary = Fabricate(:status, account: asker, visibility: :public)

    post '/api/v1/statuses', params: { status: 'Nice', in_reply_to_id: ordinary.id }, headers: headers

    expect(response).to have_http_status(200)
  end
end
