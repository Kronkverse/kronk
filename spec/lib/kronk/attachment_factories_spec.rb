# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Kronk::AttachmentFactories do
  # Reset between examples so registrations from other specs don't leak
  # into this one, and to keep this spec self-contained.
  before { described_class.reset! }

  after do
    described_class.reset!
    load Rails.root.join('config', 'initializers', 'attachment_factories', 'kalendar_albutts.rb').to_s
  end

  describe '.register + .lookup' do
    it 'stores the block by (source, target, kind) and returns it' do
      described_class.register(source: 'a', target: 'b', kind: 'spawn') { |x| x }
      expect(described_class.lookup('a', 'b', 'spawn')).to be_a(Proc)
    end

    it 'returns nil for an unregistered triple' do
      expect(described_class.lookup('a', 'b', 'spawn')).to be_nil
    end

    it 'raises when no block is given' do
      expect { described_class.register(source: 'a', target: 'b', kind: 'spawn') }
        .to raise_error(ArgumentError, /block required/)
    end
  end

  describe '.registered' do
    it 'lists every currently-registered factory' do
      described_class.register(source: 'a', target: 'b', kind: 'spawn') { nil }
      described_class.register(source: 'a', target: 'c', kind: 'spawn') { nil }
      expect(described_class.registered).to contain_exactly(
        { source: 'a', target: 'b', kind: 'spawn' },
        { source: 'a', target: 'c', kind: 'spawn' }
      )
    end
  end
end
