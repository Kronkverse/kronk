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
end
