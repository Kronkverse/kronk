# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::KornerEvents do
  before { described_class.reset! }

  describe '.subscribe / .publish' do
    it 'delivers payload to registered subscribers' do
      received = []
      described_class.subscribe('kalendar.event.created') { |p| received << p }

      described_class.publish('kalendar.event.created', event_id: 42)

      expect(received).to eq([{ event_id: 42 }])
    end

    it 'delivers to every subscriber of the same name' do
      received_a = nil
      received_b = nil
      described_class.subscribe('huddle.started') { |p| received_a = p }
      described_class.subscribe('huddle.started') { |p| received_b = p }

      described_class.publish('huddle.started', huddle_session_id: 1)

      expect(received_a).to eq(huddle_session_id: 1)
      expect(received_b).to eq(huddle_session_id: 1)
    end

    it 'isolates one subscriber raising from another' do
      received = nil
      described_class.subscribe('kommons.proposal.created') { raise 'boom' }
      described_class.subscribe('kommons.proposal.created') { |p| received = p }

      expect do
        described_class.publish('kommons.proposal.created', proposal_id: 1)
      end.to_not raise_error
      expect(received).to eq(proposal_id: 1)
    end

    it 'accepts symbol event names' do
      received = nil
      described_class.subscribe(:hello) { |p| received = p }

      described_class.publish(:hello, x: 1)

      expect(received).to eq(x: 1)
    end
  end

  describe '.subscriber_count' do
    it 'returns the count of registered subscribers' do
      described_class.subscribe('x') {}
      described_class.subscribe('x') {}
      expect(described_class.subscriber_count('x')).to eq(2)
    end
  end
end
