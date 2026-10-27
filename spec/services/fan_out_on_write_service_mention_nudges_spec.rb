# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FanOutOnWriteService do
  let(:alice) { Fabricate(:user).account }
  let(:bob)   { Fabricate(:user, account_attributes: { username: 'bob' }).account }

  before do
    bob
    allow(Nudges::EventRouter).to receive(:deliver)
  end

  it 'leaves a local post\'s mentions to ProcessMentionsService' do
    status = Fabricate(:status, account: alice, visibility: :public, text: 'Hello @bob')
    ProcessMentionsService.new.call(status)

    described_class.new.call(status)

    expect(Nudges::EventRouter).to_not have_received(:deliver).with(hash_including(verb: 'mention'))
  end
end
