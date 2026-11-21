# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::Geocoder do
  describe '.reverse' do
    let(:url) { %r{\Ahttps://nominatim\.openstreetmap\.org/reverse\?} }

    it 'names the town and its country' do
      stub_request(:get, url).to_return(body: { address: { town: 'Fremantle', state: 'Western Australia', country: 'Australia' } }.to_json)

      expect(described_class.reverse(-32.05, 115.75)).to eq 'Fremantle, Australia'
    end

    it 'falls back to the state when there is no town' do
      stub_request(:get, url).to_return(body: { address: { state: 'Western Australia', country: 'Australia' } }.to_json)

      expect(described_class.reverse(-25.0, 122.0)).to eq 'Western Australia, Australia'
    end

    it 'gives nil when Nominatim fails or the point is not one' do
      stub_request(:get, url).to_return(status: 500)

      expect(described_class.reverse(-32.05, 115.75)).to be_nil
      expect(described_class.reverse('north', 'south')).to be_nil
      expect(described_class.reverse(120, 0)).to be_nil
    end
  end
end
