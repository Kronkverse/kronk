# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Mates::UnmateService do
  subject { described_class.new }

  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }

  it 'tears down both directions of an established Mate' do
    alice.follow!(bob)
    bob.follow!(alice)

    subject.call(alice, bob)

    expect(alice.following?(bob)).to be false
    expect(bob.following?(alice)).to be false
  end

  it 'withdraws a pending outgoing request' do
    Mates::RequestService.new.call(alice, bob)

    subject.call(alice, bob)

    expect(alice.requested?(bob)).to be false
  end
end
