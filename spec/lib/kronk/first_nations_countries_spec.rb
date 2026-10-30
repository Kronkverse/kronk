# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/map.md, First Nations Country: the server says which Country a
# point, or a Trek's route, is on, from the shapes the map draws.
RSpec.describe Kronk::FirstNationsCountries do
  describe '.at' do
    it 'finds the Country a point is on' do
      expect(described_class.at(-34.9285, 138.6007)).to include(name: 'Kaurna')
    end

    it 'gives a coastal town just off the traced coast the nearest Country' do
      expect(described_class.at(-12.46, 130.84)).to include(name: 'Larrakia')
    end

    it 'has none out at sea' do
      expect(described_class.at(-40, 160)).to be_nil
    end

    it 'has none without a point' do
      expect(described_class.at(nil, 'east')).to be_nil
    end
  end

  describe '.along' do
    it 'names each Country a route passes through once, in order' do
      route = [[138.60, -34.93], [138.61, -34.92], [133.88, -23.70]]

      expect(described_class.along(route).pluck(:name)).to eq %w(Kaurna Arrernte)
    end
  end
end
