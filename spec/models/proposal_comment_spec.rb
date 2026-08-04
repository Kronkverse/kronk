# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProposalComment do
  describe 'nudging the proposal author on create' do
    let(:author)    { Fabricate(:account) }
    let(:commenter) { Fabricate(:account) }
    let(:proposal)  { Fabricate(:proposal, created_by_account: author) }

    # Stub (don't call original) so we assert the model emits the right event
    # without pulling the Nudges subscriber's side effects into a model spec.
    before { allow(Kronk::KornerEvents).to receive(:publish) }

    it 'publishes kommons.proposal.commented addressed to the proposal author' do
      Fabricate(:proposal_comment, proposal: proposal, account: commenter)

      expect(Kronk::KornerEvents).to have_received(:publish).with(
        'kommons.proposal.commented',
        hash_including(
          actor_account_id: commenter.id,
          recipient_account_id: author.id,
          proposal_id: proposal.id
        )
      )
    end

    it 'fires for a reply as well as a root comment' do
      root = Fabricate(:proposal_comment, proposal: proposal, account: commenter)
      Fabricate(:proposal_comment, proposal: proposal, account: commenter, parent: root)

      expect(Kronk::KornerEvents).to have_received(:publish)
        .with('kommons.proposal.commented', anything).twice
    end
  end

  describe 'reply fan-out' do
    let(:author)    { Fabricate(:account) } # proposal author
    let(:commenter) { Fabricate(:account) } # posts the root comment
    let(:replier)   { Fabricate(:account) } # replies to the root comment
    let(:proposal)  { Fabricate(:proposal, created_by_account: author) }

    before { allow(Kronk::KornerEvents).to receive(:publish) }

    it 'nudges both the proposal author and the parent commenter on a reply' do
      root = Fabricate(:proposal_comment, proposal: proposal, account: commenter)
      Fabricate(:proposal_comment, proposal: proposal, account: replier, parent: root)

      expect(Kronk::KornerEvents).to have_received(:publish).with(
        'kommons.proposal.commented',
        hash_including(actor_account_id: replier.id, recipient_account_id: author.id)
      )
      expect(Kronk::KornerEvents).to have_received(:publish).with(
        'kommons.proposal.commented',
        hash_including(actor_account_id: replier.id, recipient_account_id: commenter.id)
      )
    end

    it 'de-dups to one nudge when the parent commenter is also the proposal author' do
      root = Fabricate(:proposal_comment, proposal: proposal, account: author)
      Fabricate(:proposal_comment, proposal: proposal, account: replier, parent: root)

      expect(Kronk::KornerEvents).to have_received(:publish).with(
        'kommons.proposal.commented',
        hash_including(actor_account_id: replier.id, recipient_account_id: author.id)
      ).once
    end

    it 'never nudges the commenter themselves (author commenting on own proposal)' do
      Fabricate(:proposal_comment, proposal: proposal, account: author)

      expect(Kronk::KornerEvents).to_not have_received(:publish)
    end
  end
end
