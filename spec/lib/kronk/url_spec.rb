# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::Url do
  before { Kronk::KornerRegistry.reload! }

  describe '.hub_path' do
    it 'returns /hub/<slug> for a slug with no extra segments' do
      expect(described_class.hub_path('kommons')).to eq('/hub/kommons')
    end

    it 'appends string segments after the slug' do
      expect(described_class.hub_path('kommons', 'proposals'))
        .to eq('/hub/kommons/proposals')
    end

    it 'appends multiple segments in order' do
      expect(described_class.hub_path('booth', 'sets', 42))
        .to eq('/hub/booth/sets/42')
    end

    it 'coerces integer segments to strings' do
      expect(described_class.hub_path('kalendar', 42)).to eq('/hub/kalendar/42')
    end

    it 'accepts symbol slugs' do
      expect(described_class.hub_path(:kommons)).to eq('/hub/kommons')
    end

    it 'raises UnknownSlug for an unregistered slug' do
      expect { described_class.hub_path('not-a-korner') }
        .to raise_error(Kronk::Url::UnknownSlug, /not-a-korner/)
    end
  end
end
