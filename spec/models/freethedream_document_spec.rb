# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FreethedreamDocument do
  let(:now) { 1_000_000 }

  describe '.clean_member' do
    it 'keeps a well-formed suggestion and drops its tpl' do
      drop = { 'id' => 'k3x9', 'name' => 'Garden', 'tpl' => 'kronk', 'links' => ['kronk'] }

      cleaned = described_class.clean_member({ 'drops' => [drop] }, now_ms: now)

      expect(cleaned['drops'].first).to include('id' => 'k3x9', 'name' => 'Garden', 'links' => ['kronk'])
      expect(cleaned['drops'].first).to_not have_key('tpl')
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

  describe '.clean_member open-map fields' do
    it 'keeps open as a boolean and runners / dismissed as account ids' do
      drop = { 'id' => 'choir', 'open' => 'yes', 'runners' => ['12', 'x', 7], 'dismissed' => ['9'] }

      cleaned = described_class.clean_member({ 'drops' => [drop] }, now_ms: now)['drops'].first

      expect(cleaned).to include('open' => false, 'runners' => %w(12 7), 'dismissed' => ['9'])
    end
  end

  describe '.view_for' do
    # Ana (1) adds an open project and an ask-first one; Ben (2) asks to help
    # run both and edits both.
    let(:docs) do
      {
        '1' => described_class.clean_member({ 'drops' => [{ 'id' => 'garden', 'open' => true }, { 'id' => 'choir', 'dismissed' => ['9'] }] }, now_ms: now),
        '2' => described_class.clean_member({ 'claims' => ['1~garden', '1~choir'], 'edits' => { '1~garden' => { 'name' => 'G' }, '1~choir' => { 'name' => 'C' } } }, now_ms: now),
      }
    end

    it 'shows a bystander who runs an open project, but not a pending request' do
      ben = described_class.view_for(docs, '3')['2']

      expect(ben['claims']).to eq(['1~garden'])
      expect(ben['edits'].keys).to eq(['1~garden'])
    end

    it 'shows the creator the requests to help run their project' do
      expect(described_class.view_for(docs, '1')['2']['claims']).to eq(['1~garden', '1~choir'])
    end

    it 'keeps who the creator turned down to the creator' do
      expect(described_class.view_for(docs, '1')['1']['drops'].last['dismissed']).to eq(['9'])
      expect(described_class.view_for(docs, '3')['1']['drops'].last).to_not have_key('dismissed')
    end

    it 'counts a helper’s edits once the creator accepts them' do
      docs['1']['drops'].last['runners'] = ['2']
      expect(described_class.view_for(docs, '3')['2']['edits'].keys).to contain_exactly('1~garden', '1~choir')
    end
  end
end
