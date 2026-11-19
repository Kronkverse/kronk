# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db', 'migrate', '20261118120000_move_kuestion_comments_to_answers.rb')

# Tal's proposal "Kuestions", 2026-11-18: comments on a Kuestion become
# answers by the same person, and the comments themselves stay.
RSpec.describe MoveKuestionCommentsToAnswers do
  def run!
    migration = described_class.new
    migration.suppress_messages { migration.up }
  end

  let(:asker)    { Fabricate(:account, username: 'cal') }
  let(:ana)      { Fabricate(:account, username: 'ana') }
  let(:question) { publish(Question.create!(title: 'Best swim spot?', created_by_account: asker)) }

  def publish(question)
    Kuestions::PublishQuestion.new(question).call
  end

  def comment(account, text, on: question.status, at: 2.days.ago, visibility: :public)
    Fabricate(:status, account: account, thread: on, text: text, visibility: visibility, created_at: at)
  end

  it 'makes a comment its writer’s answer, with the same words and time, and keeps the comment', :aggregate_failures do
    written = comment(ana, '@cal The point, at low tide', at: 3.days.ago)

    run!

    answer = Answer.find_by(question: question, account: ana)
    expect(answer.body).to eq('The point, at low tide')
    expect(answer.created_at).to be_within(1.second).of(written.created_at)
    expect(answer.visibility_scope).to eq('public')
    expect(Status.exists?(written.id)).to be true
  end

  it 'leaves an answer someone already gave as it is' do
    Answer.create!(question: question, account: ana, body: 'The bridge')
    comment(ana, 'Also the point')

    run!

    expect(Answer.where(question: question, account: ana).pluck(:body)).to eq(['The bridge'])
  end

  it 'takes the first of several comments by one person' do
    comment(ana, 'The point', at: 3.days.ago)
    comment(ana, 'Or the bridge', at: 1.day.ago)

    run!

    expect(Answer.where(question: question, account: ana).pluck(:body)).to eq(['The point'])
  end

  it 'leaves out replies to comments, the asker’s own comments and comments with no words' do
    first = comment(ana, 'The point')
    comment(Fabricate(:account), 'Agreed', on: first)
    comment(asker, 'Thanks all')
    comment(Fabricate(:account), '@cal')

    run!

    expect(Answer.where(question: question).pluck(:account_id)).to eq([ana.id])
  end

  it 'leaves choice Kuestions alone' do
    choice = publish(Question.create!(title: 'Tea or coffee?', created_by_account: asker, answer_format: 'yn'))
    comment(ana, 'Tea', on: choice.status)

    run!

    expect(Answer.where(question: choice)).to be_empty
  end

  it 'sends no nudges and moves nothing twice' do
    comment(ana, 'The point')
    allow(Kronk::KornerEvents).to receive(:publish)

    run!
    run!

    expect(Answer.where(question: question).count).to eq(1)
    expect(Kronk::KornerEvents).to_not have_received(:publish).with('kuestions.question.answered', anything)
  end
end
