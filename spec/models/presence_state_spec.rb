# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PresenceState do
  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }

  def make_mates(one, two)
    one.follow!(two)
    two.follow!(one)
  end

  describe '.place!' do
    it 'stores a coarsened point, not the raw coordinate' do
      state = described_class.place!(alice, raw_lat: -31.97625, raw_lng: 115.85623, precision: 'hood', scope: 'friends')

      expect(state.lat).to_not eq(-31.97625)
      expect(state.lng).to_not eq(115.85623)
      expect(state.precision).to eq('hood')
    end

    it 'is one-per-account — re-placing upserts rather than duplicating' do
      described_class.place!(alice, raw_lat: 1.0, raw_lng: 2.0, precision: 'hood', scope: 'friends')

      expect { described_class.place!(alice, raw_lat: 3.0, raw_lng: 4.0, precision: 'city', scope: 'kommunity') }
        .to_not change(described_class, :count)
      expect(described_class.find_by(account_id: alice.id).precision).to eq('city')
    end

    it 'refuses an unsupported precision tier' do
      expect { described_class.place!(alice, raw_lat: 1.0, raw_lng: 2.0, precision: 'exact', scope: 'friends') }
        .to raise_error(ArgumentError)
    end
  end

  describe '#visible_to?' do
    it 'shows a friends-scoped pin to a Mate' do
      make_mates(alice, bob)
      state = described_class.place!(alice, raw_lat: 1.0, raw_lng: 2.0, precision: 'hood', scope: 'friends')

      expect(state.visible_to?(bob)).to be true
    end

    it 'hides a friends-scoped pin from a one-way follower (not a Mate)' do
      bob.follow!(alice) # one-way — not mutual
      state = described_class.place!(alice, raw_lat: 1.0, raw_lng: 2.0, precision: 'hood', scope: 'friends')

      expect(state.visible_to?(bob)).to be false
    end

    it 'shows a kommunity-scoped pin to anyone' do
      state = described_class.place!(alice, raw_lat: 1.0, raw_lng: 2.0, precision: 'hood', scope: 'kommunity')

      expect(state.visible_to?(bob)).to be true
    end

    it 'never surfaces the owner their own pin through the shared gate' do
      state = described_class.place!(alice, raw_lat: 1.0, raw_lng: 2.0, precision: 'hood', scope: 'kommunity')

      expect(state.visible_to?(alice)).to be false
    end

    it 'hides an expired pin' do
      state = described_class.place!(alice, raw_lat: 1.0, raw_lng: 2.0, precision: 'hood', scope: 'kommunity')
      state.update_column(:expires_at, 1.minute.ago)

      expect(state.visible_to?(bob)).to be false
    end
  end
end
