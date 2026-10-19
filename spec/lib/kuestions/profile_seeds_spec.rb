# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kuestions::ProfileSeeds do
  let!(:tal) { Fabricate(:account, username: 'tal') }

  describe '.sync!' do
    it "leaves a member's question in the same words with its asker" do
      member = Fabricate(:account)
      theirs = Question.create!(kind: 'profile', title: "What's your art?", answer_format: 'text', created_by_account: member)

      described_class.sync!

      expect(theirs.reload).to have_attributes(seed_key: nil, created_by_account: member, answer_format: 'text')
      expect(Question.find_by(seed_key: 'art')).to have_attributes(created_by_account: tal, title: "What's your art?")
    end

    it "adopts the seed's asker's own question in the same words" do
      own = Question.create!(kind: 'profile', title: "what's your art?", answer_format: 'text', created_by_account: tal)

      described_class.sync!

      expect(own.reload).to have_attributes(seed_key: 'art', title: "What's your art?")
      expect(Question.where(seed_key: 'art').count).to eq 1
    end
  end
end
