# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Mates::RequestService do
  subject { described_class.new }

  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }

  it 'creates a pending request rather than an immediate mutual follow' do
    subject.call(alice, bob)

    expect(alice.requested?(bob)).to be true
    expect(alice.mate?(bob)).to be false
  end

  it 'becomes Mates immediately when the other side already requested' do
    described_class.new.call(bob, alice) # bob -> alice pending
    subject.call(alice, bob)             # alice requesting back accepts theirs

    expect(alice.mate?(bob)).to be true
    expect(bob.mate?(alice)).to be true
  end

  it 'is a no-op when the two are already Mates' do
    alice.follow!(bob)
    bob.follow!(alice)

    expect { subject.call(alice, bob) }.to_not change(FollowRequest, :count)
  end

  it 'does nothing when requesting oneself' do
    expect { subject.call(alice, alice) }.to_not change(FollowRequest, :count)
  end
end
