# frozen_string_literal: true

require 'rails_helper'

# decisions.md, 2026-10-26: a Konnected record shows itself on the other
# record's page; the preview is what its card draws.
RSpec.describe Kronk::KonnectedPreview do
  let(:account) { Fabricate(:account) }

  it "gives a Place's spot and address" do
    place = MapPlace.create!(name: 'Bondi Pavilion', address: 'Queen Elizabeth Dr', latitude: -33.891, longitude: 151.277, account: account)

    expect(described_class.for('map', place)).to eq(latitude: -33.891, longitude: 151.277, address: 'Queen Elizabeth Dr')
  end

  it "gives an event's times and where it is" do
    starts = 2.days.from_now.change(usec: 0)
    event = Event.create!(account: account, title: 'Swim', start_time: starts, end_time: starts + 1.hour, location_name: 'Bronte Pool')

    expect(described_class.for('kalendar', event)).to include(start_time: starts.iso8601, end_time: (starts + 1.hour).iso8601, location: 'Bronte Pool', image: nil)
  end

  it "gives an album's photo count, and no photos while it has none" do
    album = Album.create!(owner: account, title: 'Ember', visibility: :public)

    expect(described_class.for('albutts', album)).to eq(photos: [], photo_count: 0)
  end

  it "gives a kronikle's opening lines" do
    chronicle = Chronicle.create!(owner: account, title: 'Notes', body: 'The first warm night of spring.', visibility: :public)

    expect(described_class.for('kronikles', chronicle)).to eq(line: 'The first warm night of spring.')
  end

  it 'gives nothing for a korner without one, so it stays a tile' do
    krew = Krew.create!(slug: 'growers', name: 'Growers', access: 'open')

    expect(described_class.for('krew', krew)).to be_nil
  end
end
