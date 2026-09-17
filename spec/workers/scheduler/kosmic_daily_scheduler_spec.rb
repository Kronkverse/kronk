# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Scheduler::KosmicDailyScheduler do
  subject { described_class.new.perform }

  describe '#perform' do
    it 'creates a KosmicUpdate for today if none exists' do
      expect { subject }.to change(KosmicUpdate, :count).by(1)
      expect(KosmicUpdate.last.on_date).to eq(Time.now.utc.to_date)
    end

    it 'is a no-op when today already has an update' do
      KosmicUpdate.create!(on_date: Time.now.utc.to_date, body: 'hand-authored')

      expect { subject }.to_not change(KosmicUpdate, :count)
    end

    it 'swallows race-condition unique violations' do
      allow(KosmicUpdate).to receive(:exists?).and_return(false)
      allow(KosmicUpdate).to receive(:create!).and_raise(ActiveRecord::RecordNotUnique)

      expect { subject }.to_not raise_error
    end
  end
end
