# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Booth::LiveRecordingSetWorker do
  let(:host)   { Fabricate(:account) }
  let(:live)   { Fabricate(:booth_live, account: host, started_at: 2.hours.ago, ended_at: 1.hour.ago) }
  let(:target) { Kronk::CallTarget.find!('booth_live', live.id) }

  def recording(filename, status:, media: nil)
    CallRecording.build_for(target, filename: filename, size: 100, media: media).tap { |r| r.update!(status: status) }
  end

  before do
    allow(Kronk::CallRecordingStorage).to receive(:download) do |_key, path|
      FileUtils.cp(Rails.root.join('spec', 'fixtures', 'files', 'boop.mp3', 'boop.mp3', 'files', 'boop.mp3', 'boop.mp3'), path)
      path
    end
  end

  it 'makes the draft set from a ready audio recording' do
    audio = recording('set.mp3', status: 'ready', media: 'audio')

    expect { described_class.new.perform(audio.id) }.to change { BoothSet.where(account: host, published: false).count }.by(1)
  end

  it 'leaves a video, an upload still under way and a recording that has gone alone', :aggregate_failures do
    video = recording('set.mp4', status: 'ready')
    pending_audio = recording('set.mp3', status: 'pending', media: 'audio')

    described_class.new.perform(video.id)
    described_class.new.perform(pending_audio.id)
    described_class.new.perform(0)

    expect(BoothSet.where(account: host).count).to eq 0
    expect(Kronk::CallRecordingStorage).to_not have_received(:download)
  end
end
