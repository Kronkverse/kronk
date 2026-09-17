# frozen_string_literal: true

require 'rails_helper'

RSpec.describe KornerTuneOut do
  let(:account) { Fabricate(:account) }

  describe 'validations' do
    it 'requires a korner_slug' do
      row = described_class.new(account: account, korner_slug: nil, tuned_out_at: Time.current)
      expect(row).to_not be_valid
    end

    it 'requires an account' do
      row = described_class.new(account: nil, korner_slug: 'kommons', tuned_out_at: Time.current)
      expect(row).to_not be_valid
    end

    it 'enforces uniqueness of (account, korner_slug)' do
      described_class.create!(account: account, korner_slug: 'kommons', tuned_out_at: Time.current)
      dup = described_class.new(account: account, korner_slug: 'kommons', tuned_out_at: Time.current)
      expect(dup).to_not be_valid
    end
  end
end
