# frozen_string_literal: true

require 'rails_helper'

# The nudges `listens:` entry for `kommons.proposal.commented` declares an
# aggregation window; the manifest-driven event-bus loop resolves it (via
# Nudges::Aggregator.parse_window) and passes it to Nudges::EventRouter, so a
# flurry of comments on one proposal collapses into a single re-floating nudge
# per recipient. The collapse mechanism itself is covered by
# spec/services/nudges/event_router_spec.rb (EventRouter#aggregable_event); this
# guards the manifest half — that the window is declared and parses to what the
# bus loop expects.
# Guards the manifest config (a cross-korner listen), not a single class.
RSpec.describe 'Nudges comment-burst aggregation config' do # rubocop:disable RSpec/DescribeClass
  let(:entry) do
    Kronk::KornerRegistry.find('nudges').listens.find do |e|
      e.is_a?(Hash) && e['event'] == 'kommons.proposal.commented'
    end
  end

  it 'declares an aggregation window on the proposal-comment listen' do
    expect(entry).to be_present
    expect(entry['aggregation']).to be_a(Hash)
  end

  it 'resolves to a 10-minute window via the same parser the bus loop uses' do
    expect(Nudges::Aggregator.parse_window(entry['aggregation']['window'])).to eq(10.minutes)
  end
end
