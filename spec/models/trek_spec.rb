# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Trek do
  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }
  let(:carol) { Fabricate(:account) }

  def make_mates(one, two)
    one.follow!(two)
    two.follow!(one)
  end

  describe '.record!' do
    it 'stores a privacy-trimmed route rather than the raw endpoints' do
      points = (0..12).map { |i| [115.85 + (i * 0.01), -31.95] }
      trek = described_class.record!(alice, activity_type: 'run', title: 'River loop', recorded_at: Time.now.utc, points: points)

      expect(trek.has_route).to be true
      expect(trek.route.first).to_not eq(points.first)
      expect(trek.distance_m).to be > 0
      expect(trek.state_draft?).to be true
    end

    it 'creates a hand-entered trek with no geometry' do
      trek = described_class.record!(alice, activity_type: 'walk', title: 'Dog lap', recorded_at: Time.now.utc, distance_m: 3000, moving_sec: 1800)

      expect(trek.has_route).to be false
      expect(trek.route).to be_nil
      expect(trek.distance_m).to eq(3000)
    end
  end

  describe '.feed_for and #visible_to?' do
    it 'shows my treks + my Mates published treks, but not a Mate draft' do
      make_mates(alice, bob)
      mine = described_class.record!(alice, activity_type: 'run', title: 'a', recorded_at: Time.now.utc)
      mate_published = described_class.record!(bob, activity_type: 'ride', title: 'b', recorded_at: Time.now.utc)
      mate_published.update!(state: :published)
      mate_draft = described_class.record!(bob, activity_type: 'walk', title: 'c', recorded_at: Time.now.utc)

      feed = described_class.feed_for(alice).to_a

      expect(feed).to include(mine, mate_published)
      expect(feed).to_not include(mate_draft)
    end

    it 'hides a published trek from a one-way follower (not a Mate)' do
      carol.follow!(alice) # one-way, not mutual
      trek = described_class.record!(alice, activity_type: 'run', title: 'a', recorded_at: Time.now.utc)
      trek.update!(state: :published)

      expect(trek.visible_to?(carol)).to be false
    end

    it 'always shows a trek to its owner, even as a draft' do
      trek = described_class.record!(alice, activity_type: 'run', title: 'a', recorded_at: Time.now.utc)

      expect(trek.visible_to?(alice)).to be true
    end
  end
end
