# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Mates::AcceptService do
  subject { described_class.new }

  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }

  it 'establishes a mutual follow from a pending request' do
    Mates::RequestService.new.call(alice, bob) # alice -> bob pending
    subject.call(bob, alice) # bob accepts

    expect(bob.mate?(alice)).to be true
    expect(alice.mate?(bob)).to be true
    expect(FollowRequest.exists?(account: alice, target_account: bob)).to be false
  end

  it 'does nothing without a pending request' do
    expect(subject.call(bob, alice)).to be_nil
    expect(bob.mate?(alice)).to be false
  end
end
