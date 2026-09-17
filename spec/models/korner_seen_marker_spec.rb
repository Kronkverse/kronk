# frozen_string_literal: true

require 'rails_helper'

RSpec.describe KornerSeenMarker do
  let(:account) { Fabricate(:account) }

  describe 'validations' do
    it 'requires a korner_slug' do
      row = described_class.new(account: account, korner_slug: nil, baseline_id: 1)
      expect(row).to_not be_valid
    end

    it 'enforces uniqueness of (account, korner_slug)' do
      described_class.create!(account: account, korner_slug: 'moments', baseline_id: 10)
      dup = described_class.new(account: account, korner_slug: 'moments', baseline_id: 20)
      expect(dup).to_not be_valid
    end
  end
end
