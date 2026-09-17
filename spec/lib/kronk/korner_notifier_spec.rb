# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::KornerNotifier do
  let(:recipient) { Fabricate(:account) }
  let(:actor)     { Fabricate(:account) }
  let(:proposal)  { Proposal.create!(title: 'Build it', body: 'Please build this', created_by_account_id: recipient.id) }

  describe '.notify' do
    it 'creates a notification for the recipient, from the actor' do
      expect do
        described_class.notify(recipient_id: recipient.id, from_account: actor, activity: proposal, type: 'proposal_challenged')
      end.to change(Notification, :count).by(1)

      notification = Notification.last
      expect(notification.account_id).to eq(recipient.id)
      expect(notification.from_account_id).to eq(actor.id)
      expect(notification.type.to_s).to eq('proposal_challenged')
    end

    it 'does not self-notify when actor is the recipient' do
      expect do
        described_class.notify(recipient_id: actor.id, from_account: actor, activity: proposal, type: 'proposal_challenged')
      end.to_not change(Notification, :count)
    end

    it 'no-ops on a blank recipient' do
      expect do
        described_class.notify(recipient_id: nil, from_account: actor, activity: proposal, type: 'proposal_challenged')
      end.to_not change(Notification, :count)
    end

    it 'rescues a delivery failure instead of raising' do
      expect do
        described_class.notify(recipient_id: recipient.id, from_account: actor, activity: proposal, type: 'not_a_registered_type')
      end.to_not raise_error
    end
  end
end
