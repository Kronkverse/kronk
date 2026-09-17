# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Answer do
  let(:creator) { Fabricate(:account) }
  let(:responder) { Fabricate(:account) }
  let(:question) { Question.create!(created_by_account: creator, title: 'Q?') }

  describe 'validations' do
    it 'requires a body' do
      answer = described_class.new(question: question, account: responder, body: nil)
      expect(answer).to_not be_valid
    end

    it 'requires a question' do
      answer = described_class.new(question: nil, account: responder, body: 'yes')
      expect(answer).to_not be_valid
    end

    it 'requires an account' do
      answer = described_class.new(question: question, account: nil, body: 'yes')
      expect(answer).to_not be_valid
    end

    it 'enforces one answer per (question, account)' do
      described_class.create!(question: question, account: responder, body: 'first')

      duplicate = described_class.new(question: question, account: responder, body: 'second')
      expect(duplicate).to_not be_valid
    end

    it 'allows the same account to answer a different question' do
      described_class.create!(question: question, account: responder, body: 'a')

      other = Question.create!(created_by_account: creator, title: 'Q2?')
      answer = described_class.new(question: other, account: responder, body: 'b')
      expect(answer).to be_valid
    end
  end

  describe 'associations' do
    it 'belongs to a question' do
      answer = described_class.create!(question: question, account: responder, body: 'yes')
      expect(answer.question).to eq(question)
    end

    it 'belongs to an account' do
      answer = described_class.create!(question: question, account: responder, body: 'yes')
      expect(answer.account).to eq(responder)
    end

    it 'has an optional linked Status' do
      status = Fabricate(:status, account: responder)
      answer = described_class.create!(
        question: question, account: responder, body: 'yes', status: status
      )
      expect(answer.status).to eq(status)
    end
  end
end
