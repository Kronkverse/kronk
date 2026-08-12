# frozen_string_literal: true

require 'rails_helper'

# Own-content nudges (decisions.md 2026-08-12). Each case pins one branch,
# including the silent-when-correct ones — a guard that cannot be seen refusing
# is not a guard (decisions.md 2026-08-12, decision 2).
RSpec.describe Kronk::StatusNudges do
  let(:author) { Fabricate(:account) }
  let(:actor) { Fabricate(:account) }

  before { allow(Kronk::KornerEvents).to receive(:publish) }

  def publish(**overrides)
    args = { actor_account_id: actor.id, recipient_account_id: author.id, status_id: 42 }.merge(overrides)
    described_class.publish('status.frothed', **args)
  end

  context 'when the status_nudges flag is on' do
    around do |example|
      Kronk::FeatureFlags.with_flag(status_nudges: true) { example.run }
    end

    it 'publishes the event with actor, recipient and status' do
      publish

      expect(Kronk::KornerEvents).to have_received(:publish).with(
        'status.frothed',
        hash_including(actor_account_id: actor.id, recipient_account_id: author.id, status_id: 42)
      )
    end

    it 'passes extra payload keys through, so a CTA can template off them' do
      publish(actor_acct: 'someone')

      expect(Kronk::KornerEvents).to have_received(:publish).with(
        'status.frothed', hash_including(actor_acct: 'someone')
      )
    end

    # Nobody needs telling about their own froth. EventRouter drops self-nudges
    # too; this keeps them off the bus entirely.
    it 'does not publish when the actor is the recipient' do
      publish(recipient_account_id: actor.id)

      expect(Kronk::KornerEvents).to_not have_received(:publish)
    end

    it 'does not publish when the recipient is missing' do
      publish(recipient_account_id: nil)

      expect(Kronk::KornerEvents).to_not have_received(:publish)
    end

    it 'does not publish when the actor is missing' do
      publish(actor_account_id: nil)

      expect(Kronk::KornerEvents).to_not have_received(:publish)
    end
  end

  # The flag is what makes the dual-run safe: with it off, the legacy
  # Notification path is the only one that fires.
  context 'when the status_nudges flag is off' do
    around do |example|
      Kronk::FeatureFlags.with_flag(status_nudges: false) { example.run }
    end

    it 'publishes nothing' do
      publish

      expect(Kronk::KornerEvents).to_not have_received(:publish)
    end
  end
end
