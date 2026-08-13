# frozen_string_literal: true

require 'rails_helper'

# A Tier-1 "directed at U" event fires regardless of Mate status
# (docs/kronk_nudges.md § Relevance engine). `Nudges::EventRouter` has always
# supported that via `directed: true` — covered in
# spec/services/nudges/event_router_spec.rb — but the manifest-driven bus loop
# did not forward the flag, so a directed nudge could only be expressed by
# hand-wiring a subscriber. The mate-request routes lived there for exactly
# that reason.
#
# This guards the manifest half: that the mate-request listens are declared,
# carry `directed: true`, and that a non-directed listen has not silently
# gained it. The router half (the gate bypass itself) is covered by the router
# spec; the two together cover the path end to end.
# Guards the manifest config (a cross-korner listen), not a single class.
RSpec.describe 'Nudges directed listens config' do # rubocop:disable RSpec/DescribeClass
  def listen_for(event)
    Kronk::KornerRegistry.find('nudges').listens.find do |e|
      e.is_a?(Hash) && e['event'] == event
    end
  end

  describe 'mate-request routes' do
    # A mate request is inherently non-Mate — the pair are not mutual yet —
    # so without `directed: true` the router drops it as :non_mate_dropped
    # and the invite never reaches the recipient's messenger.
    it 'declares mates.request.sent as directed' do
      entry = listen_for('mates.request.sent')

      expect(entry).to be_present
      expect(entry['directed']).to be(true)
      expect(entry['verb']).to eq('mate_requested')
      expect(entry['interaction']).to eq('interactive')
    end

    it 'declares mates.request.accepted as directed' do
      entry = listen_for('mates.request.accepted')

      expect(entry).to be_present
      expect(entry['directed']).to be(true)
      expect(entry['verb']).to eq('mate_accepted')
      expect(entry['interaction']).to eq('interactive')
    end

    # The accept CTA deep-links to the actor's conversation, so the route
    # template has to name a payload key the publisher actually ships.
    it 'templates the accept CTA off a key the publisher provides' do
      expect(listen_for('mates.request.accepted')['cta_route']).to eq('/nudges/{actor_account_id}')
    end

    # The request CTA deep-links to the requester's profile — where
    # the accept / reject buttons live for a pending mate request
    # (Tal 2026-08-13). `actor_acct` is added to the payload by
    # `Mates::RequestService#notify!` alongside `actor_account_id`.
    it 'templates the request CTA to the requester profile' do
      expect(listen_for('mates.request.sent')['cta_route']).to eq('/@{actor_acct}')
      expect(listen_for('mates.request.sent')['cta_label']).to eq('View profile')
    end
  end

  # The bus loop reads `entry['directed'] == true`, so anything absent or
  # non-true stays gated. This pins that the Mate gate still applies to the
  # ordinary korner listens — `directed` is opt-in, not the new default.
  describe 'ordinary korner listens' do
    it 'does not mark a Tier-2/3 listen as directed' do
      expect(listen_for('kommons.proposal.frothed')['directed']).to be_nil
    end

    # Enumerated deliberately rather than counted: `directed` bypasses the Mate
    # gate, so every addition should be a conscious edit here. Mate requests are
    # directed because the pair are not Mates yet; the status.* events because
    # something happened to the recipient's own content.
    it 'leaves the Mate gate on for every listen that does not opt in' do
      declared = Kronk::KornerRegistry.find('nudges').listens.select { |e| e.is_a?(Hash) }
      directed = declared.select { |e| e['directed'] == true }.pluck('event')

      expect(directed).to contain_exactly(
        'mates.request.sent',
        'mates.request.accepted',
        'status.frothed',
        'status.replied',
        'status.mentioned'
      )
    end
  end
end
