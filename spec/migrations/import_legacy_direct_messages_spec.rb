# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db', 'migrate', '20260913120000_import_legacy_direct_messages.rb')

# The migration that moves Mastodon-era private posts into the messenger.
# It runs once, on the live instance, against 161 real conversations — so
# what it does is pinned here rather than discovered on the day.
RSpec.describe ImportLegacyDirectMessages do
  subject(:run!) { described_class.new.tap { |m| m.verbose = false }.up }

  let(:alice) { Fabricate(:account) }
  let(:bob)   { Fabricate(:account) }
  let(:carol) { Fabricate(:account) }

  def direct_status(from:, to:, text: 'a private thing', at: 2.years.ago)
    status = Fabricate(:status, account: from, visibility: :direct, text: text, created_at: at, updated_at: at)
    Array(to).each { |account| Fabricate(:mention, status: status, account: account) }
    status
  end

  it 'moves a message into the conversation between the two people' do
    status = direct_status(from: alice, to: bob, text: 'just for you')

    run!

    convo = Nudges::Conversation.find_by(kind: 'mate', account_a_id: [alice.id, bob.id].min, account_b_id: [alice.id, bob.id].max)
    expect(convo).to be_present

    message = convo.messages.first
    expect(message.body).to eq('just for you')
    expect(message.author_account_id).to eq(alice.id)
    expect(message.created_at).to be_within(1.second).of(status.created_at)
  end

  it 'leaves the original visible to nobody but its author' do
    status = direct_status(from: alice, to: bob)

    run!

    expect(status.reload.visibility).to eq('self_only')
  end

  it 'sorts the conversation by the age of the message, not the import' do
    status = direct_status(from: alice, to: bob, at: 3.years.ago)

    run!

    convo = Nudges::Conversation.mate.last
    expect(convo.last_activity_at).to be_within(1.second).of(status.created_at)
  end

  it 'gives each recipient of a group message their own copy' do
    direct_status(from: alice, to: [bob, carol])

    run!

    expect(Nudges::Conversation.mate.count).to eq(2)
    expect(Nudges::ConversationMessage.count).to eq(2)
  end

  it 'carries attachments up to the cap and leaves the rest on the original' do
    status = direct_status(from: alice, to: bob)
    (described_class::MAX_MEDIA + 2).times { Fabricate(:media_attachment, account: alice, status: status) }

    run!

    message = Nudges::ConversationMessage.first
    expect(message.media_attachment_ids.size).to eq(described_class::MAX_MEDIA)
    expect(status.reload.media_attachments.count).to eq(described_class::MAX_MEDIA + 2)
  end

  it 'ignores a message addressed to nobody, but still hides it' do
    status = Fabricate(:status, account: alice, visibility: :direct, text: 'into the void')

    run!

    expect(Nudges::ConversationMessage.count).to eq(0)
    expect(status.reload.visibility).to eq('self_only')
  end

  it 'skips recipients on other servers' do
    remote = Fabricate(:account, domain: 'elsewhere.example')
    direct_status(from: alice, to: remote)

    run!

    expect(Nudges::ConversationMessage.count).to eq(0)
  end

  it 'counts the imported messages against the pair' do
    direct_status(from: alice, to: bob, at: 3.years.ago)
    direct_status(from: bob, to: alice, at: 2.years.ago)

    run!

    relationship = Nudges::Relationship.for_pair(alice.id, bob.id)
    expect(relationship.message_count).to eq(2)
    # Importing history should not announce that somebody just hit a milestone.
    expect(relationship.last_milestone_hit).to eq(0)
  end

  it 'does nothing on a second run' do
    direct_status(from: alice, to: bob)

    run!
    expect { described_class.new.tap { |m| m.verbose = false }.up }
      .to_not change(Nudges::ConversationMessage, :count)
  end
end
