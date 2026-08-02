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

    context 'with an aggregation window (a burst on one subject)' do
      before { make_mates!(alice, bob) }

      # Mirrors the albutts `album_new_photo` case: repeated activity on
      # the same source ref (Album) within the window collapses onto one
      # event instead of stacking a row per photo.
      let(:agg_args) do
        {
          actor: alice,
          recipient: bob,
          source_korner_slug: 'albutts',
          verb: 'added_photo',
          source_type: 'Album',
          source_id: 7,
          interaction: 'interactive',
          cta_label: 'View album',
          cta_route: '/hub/albutts/albums/7',
          aggregate_window: 15.minutes,
        }
      end

      it 'collapses a second delivery in-window onto the first event' do
        first  = described_class.deliver(**agg_args)
        second = travel(5.minutes) { described_class.deliver(**agg_args) }

        expect(Nudges::Event.count).to eq(1)
        expect(second.id).to eq(first.id)
      end

      it 're-floats the collapsed event to the latest delivery time' do
        first    = described_class.deliver(**agg_args)
        original = first.created_at

        travel(5.minutes) { described_class.deliver(**agg_args) }

        expect(first.reload.created_at).to be > original
      end

      it 'surfaces the latest actor on the collapsed event' do
        # Same Mate conversation (mate_between! is order-independent), so a
        # reply-direction contribution lands on the same event and updates
        # who it is from.
        described_class.deliver(**agg_args)
        travel(5.minutes) do
          described_class.deliver(**agg_args.merge(actor: bob, recipient: alice))
        end

        expect(Nudges::Event.count).to eq(1)
        expect(Nudges::Event.first.actor_account).to eq(bob)
      end

      it 'starts a fresh event once the window has elapsed' do
        described_class.deliver(**agg_args)
        travel(20.minutes) { described_class.deliver(**agg_args) }

        expect(Nudges::Event.count).to eq(2)
      end

      it 'does not collapse across different source refs' do
        described_class.deliver(**agg_args)
        travel(5.minutes) { described_class.deliver(**agg_args.merge(source_id: 8)) }

        expect(Nudges::Event.count).to eq(2)
      end

      it 'does not collapse a different verb on the same subject' do
        described_class.deliver(**agg_args)
        travel(5.minutes) { described_class.deliver(**agg_args.merge(verb: 'removed_photo')) }

        expect(Nudges::Event.count).to eq(2)
      end

      it 'never aggregates without a window (default behaviour is preserved)' do
        described_class.deliver(**agg_args.merge(aggregate_window: nil))
        travel(1.minute) { described_class.deliver(**agg_args.merge(aggregate_window: nil)) }

        expect(Nudges::Event.count).to eq(2)
      end
    end
  end

  describe '.window_for resolution used by aggregating callers' do
    it 'resolves the albutts album_new_photo window from the manifest' do
      expect(Nudges::Aggregator.window_for('album_new_photo', korner_slug: 'albutts'))
        .to eq(15.minutes)
    end

    it 'returns nil for a type that declares no aggregation window' do
      expect(Nudges::Aggregator.window_for('contribution_rights_granted', korner_slug: 'albutts'))
        .to be_nil
    end
  end
end
