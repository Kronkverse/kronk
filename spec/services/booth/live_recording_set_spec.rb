# frozen_string_literal: true

require 'rails_helper'

# docs/spaces/booth.md, Recording a live set: a live set's audio recording
# becomes a draft set for its host.
RSpec.describe Booth::LiveRecordingSet do
  let(:host) { Fabricate(:account, display_name: 'Rosa') }
  let(:live) do
    Fabricate(:booth_live, account: host, title: 'Friday Warm-up', description: 'Deep cuts', genres: %w(house dub),
                           started_at: 2.hours.ago, ended_at: 1.hour.ago)
  end
  let(:recording) do
    CallRecording.build_for(Kronk::CallTarget.find!('booth_live', live.id), filename: 'warmup.ogg', size: 100, media: 'audio')
                 .tap { |r| r.update!(status: 'ready', duration: 3) }
  end

  before do
    # Storage is stubbed: the "download" copies a small fixture into place.
    allow(Kronk::CallRecordingStorage).to receive(:download) do |_key, path|
      FileUtils.cp(Rails.root.join('spec', 'fixtures', 'files', 'boop.ogg', 'boop.ogg', 'files', 'boop.ogg', 'boop.ogg'), path)
      path
    end
    live.moments.create!(account: host, kind: 'track', artist: 'Burial', title: 'Archangel')
    live.moments.create!(account: host, kind: 'shoutout', body: 'Not a track')
  end

  it 'makes an unpublished live recording for the host, from the live set', :aggregate_failures do
    set = described_class.new(recording).call

    expect(set).to be_persisted
    expect(set).to have_attributes(
      account: host,
      title: 'Friday Warm-up',
      description: 'Deep cuts',
      genres: %w(house dub),
      kind: 'live_recording',
      published: false,
      artist_name: 'Rosa',
      cover_attachment: nil
    )
    expect(set.tracklist).to eq [{ 'start_seconds' => live.moments.tracks.first.at_seconds, 'artist' => 'Burial', 'title' => 'Archangel' }]
    expect(set.audio_attachment).to have_attributes(account: host, type: 'audio')
    expect(set.duration_seconds).to be_a(Integer)
    expect(live.reload.booth_set).to eq set
  end

  it 'tells the host it is ready to publish', :aggregate_failures do
    set = described_class.new(recording).call

    nudge = Nudges::Event.find_by(recipient_account: host, verb: 'set_ready')
    expect(nudge).to have_attributes(source_korner_slug: 'booth', source_type: 'BoothSet', source_id: set.id, cta_route: "/hub/booth/sets/#{set.id}")
  end

  it 'makes one set however often it runs', :aggregate_failures do
    first = described_class.new(recording).call
    again = described_class.new(recording.reload).call

    expect(again).to eq first
    expect(BoothSet.where(account: host).count).to eq 1
    expect(Kronk::CallRecordingStorage).to have_received(:download).once
  end
end
