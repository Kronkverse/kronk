# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::Event do
  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }
  let(:convo) { Nudges::Conversation.mate_between!(alice, bob) }

  describe 'validations' do
    it 'requires a source korner slug and verb' do
      event = described_class.new(conversation: convo, actor_account: bob, interaction: 'passive')
      expect(event).to_not be_valid
      expect(event.errors[:source_korner_slug]).to be_present
      expect(event.errors[:verb]).to be_present
    end

    it 'refuses invalid interaction' do
      event = described_class.new(
        conversation: convo,
        actor_account: bob,
        source_korner_slug: 'kommons',
        verb: 'frothed',
        interaction: 'nonsense'
      )
      expect(event).to_not be_valid
    end

    it 'refuses CTA fields on passive events' do
      event = described_class.new(
        conversation: convo,
        actor_account: bob,
        source_korner_slug: 'kommons',
        verb: 'boost',
        interaction: 'passive',
        cta_label: 'nope',
        cta_route: '/nope'
      )
      expect(event).to_not be_valid
      expect(event.errors[:cta_route]).to include(/interactive/)
    end
  end

  describe 'creation' do
    it 'saves an interactive event with a CTA' do
      event = described_class.create!(
        conversation: convo,
        actor_account: bob,
        source_korner_slug: 'kommons',
        verb: 'frothed',
        source_type: 'Proposal',
        source_id: 42,
        interaction: 'interactive',
        cta_label: 'View proposal',
        cta_route: '/hub/kommons/p/42'
      )
      expect(event).to be_persisted
    end

    it 'bumps the conversation last_activity_at' do
      convo.update!(last_activity_at: 1.day.ago)
      expect do
        described_class.create!(
          conversation: convo,
          actor_account: bob,
          source_korner_slug: 'kalendar',
          verb: 'rsvp',
          interaction: 'passive'
        )
      end.to(change { convo.reload.last_activity_at })
    end
  end
end
