# frozen_string_literal: true

require 'rails_helper'

# Guards the manifest half of the own-content nudges: the three `status.*`
# events are declared, directed, and their CTA templates only reference payload
# keys the publishers actually ship. A CTA naming a key nobody sends renders the
# literal `{token}` in the UI, which is the kind of thing that ships unnoticed.
# Guards manifest config (a cross-korner listen), not a single class.
RSpec.describe 'Nudges own-content listens config' do # rubocop:disable RSpec/DescribeClass
  def listen_for(event)
    Kronk::KornerRegistry.find('nudges').listens.find do |e|
      e.is_a?(Hash) && e['event'] == event
    end
  end

  # Keys Kronk::StatusNudges always sends.
  let(:always_sent) { %w(actor_account_id recipient_account_id status_id) }

  it 'declares status.frothed as directed and passive, with a collapse window' do
    entry = listen_for('status.frothed')

    expect(entry).to be_present
    expect(entry['directed']).to be(true)
    expect(entry['interaction']).to eq('passive')
    expect(Nudges::Aggregator.parse_window(entry.dig('aggregation', 'window'))).to eq(10.minutes)
  end

  it 'declares status.replied as directed and interactive' do
    entry = listen_for('status.replied')

    expect(entry).to be_present
    expect(entry['directed']).to be(true)
    expect(entry['interaction']).to eq('interactive')
  end

  it 'declares status.mentioned as directed and interactive' do
    entry = listen_for('status.mentioned')

    expect(entry).to be_present
    expect(entry['directed']).to be(true)
    expect(entry['interaction']).to eq('interactive')
  end

  # `status.reblogged` must NOT be declared: #1407 retired Boost from the action
  # bar, so nothing local can boost, and federation is deferred. Declaring it
  # would promise a notification that cannot fire.
  it 'does not declare status.reblogged' do
    expect(listen_for('status.reblogged')).to be_nil
  end

  describe 'CTA templates' do
    # actor_acct is shipped by the reply and mention publishers specifically so
    # the CTA can link to the post the actor authored.
    let(:sent_keys) { always_sent + %w(actor_acct in_reply_to_id) }

    it 'only references payload keys the publishers send' do
      %w(status.frothed status.replied status.mentioned).each do |event|
        route = listen_for(event)['cta_route']
        next if route.blank?

        tokens = route.scan(/\{(\w+)\}/).flatten
        expect(tokens - sent_keys).to be_empty, "#{event} CTA references unsent keys: #{(tokens - sent_keys).join(', ')}"
      end
    end

    it 'links the reply CTA to the actor-authored status path' do
      expect(listen_for('status.replied')['cta_route']).to eq('/@{actor_acct}/{status_id}')
    end
  end
end
