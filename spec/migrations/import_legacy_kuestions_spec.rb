# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db', 'migrate', '20260913140000_import_legacy_kuestions.rb')

# Kuestions v1 lived on statuses; v2 has its own tables. This runs once, on
# the live instance, over four questions and ten answers.
RSpec.describe ImportLegacyKuestions do
  subject(:run!) { run_migration }

  let(:asker)     { Fabricate(:account) }
  let(:answerer)  { Fabricate(:account) }

  def run_migration
    migration = described_class.new
    migration.suppress_messages { migration.up }
  end

  def legacy_question(text: 'what is the best biscuit?', account: asker)
    Fabricate(:status, account: account, text: text, post_type: :question, visibility: :public)
  end

  def legacy_answer(question, text: 'hobnob', account: answerer, visibility: :public)
    Fabricate(:status, account: account, text: text, post_type: :answer,
                       in_reply_to_id: question.id, visibility: visibility)
  end

  it 'turns a question post into a question' do
    status = legacy_question(text: 'what is the best biscuit?')

    run!

    question = Question.find_by(status_id: status.id)
    expect(question).to be_present
    expect(question.title).to eq('what is the best biscuit?')
    expect(question.created_by_account_id).to eq(asker.id)
    expect(question.created_at).to be_within(1.second).of(status.created_at)
  end

  it 'attaches the replies to it as answers' do
    question_status = legacy_question
    reply = legacy_answer(question_status, text: 'hobnob, obviously')

    run!

    answer = Answer.find_by(status_id: reply.id)
    expect(answer).to be_present
    expect(answer.question).to eq(Question.find_by(status_id: question_status.id))
    expect(answer.body).to eq('hobnob, obviously')
    expect(answer.account_id).to eq(answerer.id)
  end

  it 'leaves the original posts alone' do
    question_status = legacy_question
    reply = legacy_answer(question_status)

    run!

    expect(question_status.reload.visibility).to eq('public')
    expect(reply.reload.visibility).to eq('public')
  end

  it 'gives an answer the same reach as the post it came from' do
    question_status = legacy_question
    reply = legacy_answer(question_status, visibility: :self_only)

    run!

    expect(Answer.find_by(status_id: reply.id).visibility_scope).to eq('self_only')
  end

  it 'cuts an over-long question down to a title' do
    status = legacy_question(text: 'w' * 400)

    run!

    title = Question.find_by(status_id: status.id).title
    expect(title.length).to eq(described_class::TITLE_LIMIT)
  end

  it 'ignores an answer post whose question is not there' do
    stray = Fabricate(:status, account: answerer, text: 'orphan', post_type: :answer, visibility: :public)

    run!

    expect(Answer.find_by(status_id: stray.id)).to be_nil
  end

  it 'keeps one answer per person per question' do
    question_status = legacy_question
    legacy_answer(question_status, text: 'first')
    legacy_answer(question_status, text: 'second')

    run!

    expect(Answer.count).to eq(1)
  end

  it 'does nothing on a second run' do
    question_status = legacy_question
    legacy_answer(question_status)

    run!

    expect { run_migration }.to_not change(Answer, :count)
    expect(Question.count).to eq(1)
  end
end
