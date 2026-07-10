# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kuestions::VisibilityGate do
  let(:creator)   { Fabricate(:account) }
  let(:responder) { Fabricate(:account) }
  let(:onlooker)  { Fabricate(:account) }

  def make_question(locked:)
    q = Question.create!(created_by_account: creator, title: 'Q?', locked: locked)
    Answer.create!(question: q, account: responder, body: 'my answer')
    q
  end

  describe '.visible_answers' do
    context 'on a locked question' do
      let(:question) { make_question(locked: true) }

      it 'hides other-account answers from an onlooker who has not answered' do
        result = described_class.visible_answers(question, onlooker)
        expect(result).to be_empty
      end

      it 'exposes only their own answer to the responder' do
        result = described_class.visible_answers(question, responder)
        expect(result.pluck(:account_id)).to contain_exactly(responder.id)
      end

      it 'exposes all answers once the onlooker answers' do
        Answer.create!(question: question, account: onlooker, body: 'now I have too')
        result = described_class.visible_answers(question, onlooker)
        expect(result.pluck(:account_id)).to contain_exactly(responder.id, onlooker.id)
      end

      it 'returns none for anonymous viewers' do
        expect(described_class.visible_answers(question, nil)).to be_empty
      end
    end

    context 'on an unlocked question' do
      let(:question) { make_question(locked: false) }

      it 'exposes all answers to any viewer including anonymous' do
        result = described_class.visible_answers(question, nil)
        expect(result.pluck(:account_id)).to include(responder.id)
      end

      it 'exposes all answers to an onlooker who has not answered' do
        result = described_class.visible_answers(question, onlooker)
        expect(result.pluck(:account_id)).to include(responder.id)
      end
    end
  end

  describe '.can_view_answers?' do
    it 'is true on an unlocked question regardless of viewer' do
      question = make_question(locked: false)
      expect(described_class.can_view_answers?(question, nil)).to be true
      expect(described_class.can_view_answers?(question, onlooker)).to be true
    end

    it 'is false on a locked question when the viewer has not answered' do
      question = make_question(locked: true)
      expect(described_class.can_view_answers?(question, onlooker)).to be false
    end

    it 'is true on a locked question after the viewer answers' do
      question = make_question(locked: true)
      Answer.create!(question: question, account: onlooker, body: 'x')
      expect(described_class.can_view_answers?(question, onlooker)).to be true
    end
  end
end
