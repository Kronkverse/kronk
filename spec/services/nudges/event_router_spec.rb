# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::EventRouter do
  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }

  let(:base_args) do
    {
      actor: alice,
      recipient: bob,
      source_korner_slug: 'kommons',
      verb: 'backed',
      source_type: 'Proposal',
      source_id: 42,
      interaction: 'interactive',
      cta_label: 'View proposal',
      cta_route: '/hub/kommons/p/42',
    }
  end

  # Mates = mutual follow. Set up both directions once for the happy-path specs.
  def make_mates!(one, two)
    Fabricate(:follow, account: one, target_account: two)
    Fabricate(:follow, account: two, target_account: one)
  end

  describe '.deliver' do
    context 'when actor and recipient are Mates' do
      before { make_mates!(alice, bob) }

      it 'creates a Nudges::Event on their Mate conversation' do
        expect { described_class.deliver(**base_args) }
          .to change(Nudges::Event, :count).by(1)

        conversation = Nudges::Conversation.mate_between!(alice, bob)
        event = conversation.events.last
        expect(event.actor_account).to eq(alice)
        expect(event.source_korner_slug).to eq('kommons')
        expect(event.verb).to eq('backed')
        expect(event.interaction).to eq('interactive')
        expect(event.cta_route).to eq('/hub/kommons/p/42')
      end

      it 'reuses an existing Mate conversation on a second delivery' do
        described_class.deliver(**base_args)
        expect { described_class.deliver(**base_args.merge(verb: 'frothed')) }
          .to_not change(Nudges::Conversation, :count)
      end

      it 'nulls the CTA on a passive event' do
        event = described_class.deliver(
          **base_args.merge(interaction: 'passive', verb: 'boost')
        )
        expect(event.cta_label).to be_nil
        expect(event.cta_route).to be_nil
      end
    end

    context 'when actor and recipient are not Mates' do
      it 'drops the event' do
        expect { described_class.deliver(**base_args) }
          .to_not change(Nudges::Event, :count)
      end

      it 'returns the :non_mate_dropped sentinel' do
        expect(described_class.deliver(**base_args)).to eq(:non_mate_dropped)
      end
    end

    context 'when only one direction follows' do
      it 'still drops (Mates require mutual follow)' do
        Fabricate(:follow, account: bob, target_account: alice)
        expect(described_class.deliver(**base_args)).to eq(:non_mate_dropped)
      end
    end

    context 'when actor and recipient are the same account' do
      before { make_mates!(alice, bob) }

      it 'drops the self-nudge' do
        expect(
          described_class.deliver(**base_args.merge(recipient: alice))
        ).to eq(:self_dropped)
      end
    end
  end
end
