# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProcessMentionsService do
  subject { described_class.new }

  let(:alice) { Fabricate(:user).account }
  let(:bob)   { Fabricate(:user, account_attributes: { username: 'bob' }).account }
  let(:carol) { Fabricate(:user, account_attributes: { username: 'carol' }).account }

  before do
    bob
    carol
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
