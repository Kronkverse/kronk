# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::FeatureFlags do
  around do |example|
    described_class.reload!
    example.run
  ensure
    described_class.reload!
  end

  def seed(hash)
    described_class.instance_variable_set(:@flags, hash.transform_keys(&:to_s))
  end

  describe '.enabled?' do
    it 'returns false for flags not declared anywhere' do
      seed({})
      expect(described_class.enabled?(:missing)).to be false
    end

    it 'returns true for flags explicitly set true' do
      seed(example: true)
      expect(described_class.enabled?(:example)).to be true
      expect(described_class.enabled?('example')).to be true
    end

    it 'returns false for flags set to non-true values' do
      seed(example: 'yes', other: 1, third: nil)
      expect(described_class.enabled?(:example)).to be false
      expect(described_class.enabled?(:other)).to be false
      expect(described_class.enabled?(:third)).to be false
    end
  end

  describe '.with_flag' do
    it 'temporarily overrides a flag inside the block' do
      seed(example: false)
      described_class.with_flag(example: true) do
        expect(described_class.enabled?(:example)).to be true
      end
      expect(described_class.enabled?(:example)).to be false
    end

    it 'restores state when the block raises' do
      seed(example: false)
      expect do
        described_class.with_flag(example: true) { raise 'boom' }
      end.to raise_error('boom')
      expect(described_class.enabled?(:example)).to be false
    end
  end

  describe '.reload!' do
    it 'clears cached flags so the next read re-parses the YAML' do
      seed(example: true)
      described_class.reload!
      expect(described_class.enabled?(:example)).to be false
    end
  end
end
