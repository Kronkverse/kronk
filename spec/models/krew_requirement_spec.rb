# frozen_string_literal: true

require 'rails_helper'

RSpec.describe KrewRequirement do
  let(:krew) { Krew.create!(slug: 'gated', name: 'Gated', access: 'requirement_gated') }

  describe 'validations' do
    it 'requires a known kind' do
      expect(described_class.new(krew: krew, kind: 'unknown')).to_not be_valid
    end

    it 'requires event_id when attending_event' do
      expect(described_class.new(krew: krew, kind: 'attending_event')).to_not be_valid
    end

    it 'requires region when located_in' do
      expect(described_class.new(krew: krew, kind: 'located_in')).to_not be_valid
      expect(described_class.new(krew: krew, kind: 'located_in', region: 'Melbourne')).to be_valid
    end

    it 'requires vouch_params when vouched_by_member' do
      expect(described_class.new(krew: krew, kind: 'vouched_by_member')).to_not be_valid
      expect(described_class.new(krew: krew, kind: 'vouched_by_member', vouch_params: { min: 1 })).to be_valid
    end
  end
end
