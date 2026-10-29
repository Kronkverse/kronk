# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProcessMentionsService do
  subject { described_class.new }

  let(:alice) { Fabricate(:user).account }
  let(:bob)   { Fabricate(:user, account_attributes: { username: 'bob' }).account }
  let(:carol) { Fabricate(:user, account_attributes: { username: 'carol' }).account }

  let(:dave)  { Fabricate(:user, account_attributes: { username: 'dave' }).account }

  # Only Mates are told (Kronk::MentionNudges, decisions.md 2026-10-29).
  def mates!(one, two)
    one.follow!(two)
    two.follow!(one)
  end

  before do
    mates!(alice, bob)
    mates!(alice, carol)
    dave
    allow(Kronk::StatusNudges).to receive(:publish)
  end

  def nudged(account)
    have_received(:publish).with('status.mentioned', hash_including(recipient_account_id: account.id))
  end

  it 'nudges someone once when they are named twice' do
    status = Fabricate(:status, account: alice, text: 'Hello @bob, and again @bob')

    subject.call(status)

    expect(Kronk::StatusNudges).to nudged(bob).once
  end

  it 'nudges no one who is not a Mate of the author' do
    status = Fabricate(:status, account: alice, text: 'Hello @bob and @dave')

    subject.call(status)

    expect(Kronk::StatusNudges).to nudged(bob).once
    expect(Kronk::StatusNudges).to_not nudged(dave)
  end

  it 'nudges no one about a post they cannot open' do
    status = Fabricate(:status, account: alice, visibility: :self_only, text: 'Note to self about @bob')

    subject.call(status)

    expect(Kronk::StatusNudges).to_not nudged(bob)
  end

  context 'when a post is edited' do
    let(:status) { Fabricate(:status, account: alice, text: 'Hello @bob') }

    before { subject.call(status) }

    it 'nudges only the person newly mentioned' do
      status.update!(text: 'Hello @bob and @carol')
      described_class.new.call(status)

      expect(Kronk::StatusNudges).to nudged(bob).once
      expect(Kronk::StatusNudges).to nudged(carol).once
    end

    it 'nudges nobody again when no one new is mentioned' do
      status.update!(text: 'Hello again @bob')
      described_class.new.call(status)

      expect(Kronk::StatusNudges).to nudged(bob).once
    end
  end
end
