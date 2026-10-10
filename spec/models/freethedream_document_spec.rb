# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FreethedreamDocument do
  let(:now) { 1_000_000 }

  describe '.clean_member' do
    it 'keeps a well-formed suggestion and drops its tpl' do
      drop = { 'id' => 'k3x9', 'name' => 'Garden', 'tpl' => 'kronk', 'links' => ['kronk'] }

      cleaned = described_class.clean_member({ 'drops' => [drop] }, now_ms: now)

      expect(cleaned['drops']).to eq([{ 'id' => 'k3x9', 'name' => 'Garden', 'links' => ['kronk'] }])
    end

    # A far-future stamp would outrank every admin edit forever.
    it 'pulls a future `at` back to now' do
      cleaned = described_class.clean_member({ 'edits' => { 'kronk' => { 'at' => 1e300 } } }, now_ms: now)
      expect(cleaned.dig('edits', 'kronk', 'at')).to eq(now)
    end

    # The page looks ids up in plain objects, where these match inherited
    # properties and crash the map for every viewer.
    it 'refuses reserved names as ids or keys' do
      expect { described_class.clean_member({ 'drops' => [{ 'id' => 'a', 'links' => ['constructor'] }] }, now_ms: now) }
        .to raise_error(described_class::Invalid)
      expect { described_class.clean_member({ 'follows' => { '__proto__' => 1 } }, now_ms: now) }
        .to raise_error(described_class::Invalid)
    end

    it 'refuses ids the page would build selectors or pairs from unsafely' do
      expect { described_class.clean_member({ 'drops' => [{ 'id' => 'a"b' }] }, now_ms: now) }
        .to raise_error(described_class::Invalid)
      expect { described_class.clean_member({ 'edits' => { 'a|b' => {} } }, now_ms: now) }
        .to raise_error(described_class::Invalid)
    end
  end

  describe '.map_key?' do
    it 'allows the documents the page writes and nothing else' do
      expect(described_class.map_key?('approved')).to be(true)
      expect(described_class.map_key?('logo-kronk')).to be(true)
      expect(described_class.map_key?('logo-__proto__')).to be(false)
      expect(described_class.map_key?('anything')).to be(false)
    end
  end
end
