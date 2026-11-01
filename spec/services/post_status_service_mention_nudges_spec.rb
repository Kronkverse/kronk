# frozen_string_literal: true

require 'rails_helper'

# A new post's "mentioned you" nudge (Kronk::MentionNudges, decisions.md
# 2026-10-29): Mates of the author who can open the post, once each.
RSpec.describe PostStatusService do
  subject { described_class.new }

  let(:alice) { Fabricate(:user).account }
  let(:bob)   { Fabricate(:user, account_attributes: { username: 'bob' }).account }
  let(:dave)  { Fabricate(:user, account_attributes: { username: 'dave' }).account }

  before do
    alice.follow!(bob)
    bob.follow!(alice)
    dave
    allow(Kronk::StatusNudges).to receive(:publish)
  end

  def nudged(account)
    have_received(:publish).with('status.mentioned', hash_including(recipient_account_id: account.id))
  end

  it 'nudges a Mate it names, once' do
    subject.call(alice, text: 'Hello @bob, and again @bob', visibility: 'public')

    expect(Kronk::StatusNudges).to nudged(bob).once
  end

  it 'nudges no one who is not a Mate, though the name stays in the post' do
    status = subject.call(alice, text: 'Hello @dave', visibility: 'public')

    expect(Kronk::StatusNudges).to_not nudged(dave)
    expect(status.text).to include('@dave')
  end

  it 'nudges no Mate about a post only the author can see' do
    subject.call(alice, text: 'Note to self about @bob', visibility: 'self_only')

    expect(Kronk::StatusNudges).to_not nudged(bob)
  end
end
