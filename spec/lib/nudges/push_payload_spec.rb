# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Nudges::PushPayload do
  let(:ana) { Fabricate(:account, display_name: 'Ana') }
  let(:bob) { Fabricate(:account) }

  it 'says who, in the words of the space it came from' do
    event = Fabricate(:nudges_event, conversation: nil, actor_account: ana, recipient_account: bob, source_korner_slug: 'rose', verb: 'received')

    payload = described_class.new(event, recipient: bob).as_json

    expect(payload).to include(kronk_nudge: true, title: 'Ana sent you a rose', tag: "nudge-#{event.id}")
  end

  it 'names the space for a pair it has no sentence for' do
    event = Fabricate(:nudges_event, conversation: nil, actor_account: ana, recipient_account: bob, source_korner_slug: 'kalendar', verb: 'something_new')

    expect(described_class.new(event, recipient: bob).as_json[:title]).to eq('Ana has something for you in Kalendar')
  end

  it 'says who wrote a message, never what it says' do
    conversation = Fabricate(:nudges_conversation, one: ana, two: bob)
    message = Fabricate(:nudges_conversation_message, conversation: conversation, author_account: ana, body: 'secret plans')

    payload = described_class.new(message, recipient: bob).as_json

    expect(payload).to include(title: 'Ana nudged you', body: nil, url: "/nudges/#{conversation.id}", tag: "nudges-chat-#{conversation.id}")
  end
end
