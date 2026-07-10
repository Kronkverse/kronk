# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Question do
  let(:creator) { Fabricate(:account) }

  describe 'validations' do
    it 'requires a title' do
      question = described_class.new(created_by_account: creator, title: nil)
      expect(question).to_not be_valid
    end

    it 'requires a created_by_account' do
      question = described_class.new(created_by_account: nil, title: 'Question?')
      expect(question).to_not be_valid
    end

    it 'caps the title at 240 characters' do
      question = described_class.new(created_by_account: creator, title: 'x' * 241)
      expect(question).to_not be_valid
    end
  end

  describe '#answered_by?' do
    let(:question) { described_class.create!(created_by_account: creator, title: 'Q?') }
    let(:responder) { Fabricate(:account) }

    it 'returns false when the account has no Answer row' do
      expect(question.answered_by?(responder)).to be false
    end

    it 'returns true after the account posts an answer' do
      Answer.create!(question: question, account: responder, body: 'A')
      expect(question.answered_by?(responder)).to be true
    end

    it 'returns false when the account is nil' do
      expect(question.answered_by?(nil)).to be false
    end
  end

  describe 'Answer uniqueness per question' do
    let(:question) { described_class.create!(created_by_account: creator, title: 'Q?') }
    let(:account) { Fabricate(:account) }

    it 'prevents the same account answering twice' do
      Answer.create!(question: question, account: account, body: 'A1')
      dup = Answer.new(question: question, account: account, body: 'A2')
      expect(dup).to_not be_valid
    end

    it 'allows two different accounts to answer the same question' do
      Answer.create!(question: question, account: account, body: 'A1')
      other = Fabricate(:account)
      second = Answer.new(question: question, account: other, body: 'A2')
      expect(second).to be_valid
    end
  end
end
