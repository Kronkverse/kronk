# frozen_string_literal: true

require 'rails_helper'

RSpec.describe BoothLiveMoment do
  let(:live)    { Fabricate(:booth_live, started_at: 90.seconds.ago) }
  let(:account) { Fabricate(:account) }

  def build(**attributes)
    described_class.new(booth_live: live, account: account, **attributes)
  end

  it 'times itself from the start of the set' do
    moment = build(kind: 'shoutout', body: 'Yes').tap(&:save!)

    expect(moment.at_seconds).to be_within(3).of(90)
  end

  it 'needs words for a shoutout or request, and a known key for a reaction', :aggregate_failures do
    expect(build(kind: 'shoutout', body: '')).to_not be_valid
    expect(build(kind: 'request', body: 'x' * 201)).to_not be_valid
    expect(build(kind: 'reaction', body: 'rewind')).to be_valid
    expect(build(kind: 'reaction', body: 'boo')).to_not be_valid
    expect(build(kind: 'cheer', body: 'Yes')).to_not be_valid
  end

  describe 'a track' do
    it 'reads "Artist - Title" the way a set’s track list does', :aggregate_failures do
      moment = build(kind: 'track')
      moment.track_text = 'Jay-Z - 99 Problems'
      expect(moment).to have_attributes(artist: 'Jay-Z', title: '99 Problems', text: 'Jay-Z – 99 Problems')

      moment.track_text = 'Untitled'
      expect(moment).to have_attributes(artist: nil, title: 'Untitled', text: 'Untitled')
    end

    it 'needs a title' do
      expect(build(kind: 'track', title: '')).to_not be_valid
    end

    it 'stops at the length of a set’s track list' do
      stub_const('BoothSet::TRACKLIST_MAX', 1)
      build(kind: 'track', title: 'One').save!

      expect(build(kind: 'track', title: 'Two')).to_not be_valid
    end

    it 'becomes a track list entry' do
      moment = build(kind: 'track', artist: 'Burial', title: 'Archangel').tap(&:save!)

      expect(moment.to_track).to eq('start_seconds' => moment.at_seconds, 'artist' => 'Burial', 'title' => 'Archangel')
    end
  end

  describe '.too_soon?' do
    it 'is true for a second moment within the throttle, and not after', :aggregate_failures do
      build(kind: 'reaction', body: 'froth').save!

      expect(described_class.too_soon?(live, account)).to be true
      expect(described_class.too_soon?(live, account, now: 3.seconds.from_now)).to be false
      expect(described_class.too_soon?(live, Fabricate(:account))).to be false
    end
  end
end
