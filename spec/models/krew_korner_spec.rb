# frozen_string_literal: true

require 'rails_helper'

RSpec.describe KrewKorner do
  let(:krew) { Krew.create!(slug: 'attach-krew', name: 'Attach', access: 'open') }

  describe 'validations' do
    it 'requires a known korner slug' do
      expect(described_class.new(krew: krew, korner: 'unknown')).to_not be_valid
    end

    it 'accepts every registered korner slug' do
      described_class::KORNERS.each do |slug|
        row = described_class.new(krew: krew, korner: slug)
        expect(row).to be_valid, "#{slug} should be accepted"
      end
    end

    it 'is unique per (krew, korner)' do
      described_class.create!(krew: krew, korner: 'booth')
      expect(described_class.new(krew: krew, korner: 'booth')).to_not be_valid
    end
  end
end
