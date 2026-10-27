# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CallRecording do
  let(:live)   { Fabricate(:booth_live, started_at: 1.hour.ago, ended_at: 1.minute.ago) }
  let(:target) { Kronk::CallTarget.find!('booth_live', live.id) }

  before do
    allow(Kronk::CallRecordingStorage).to receive_messages(available?: true, delete: true)
  end

  def build(filename, media: nil)
    described_class.build_for(target, filename: filename, size: 10, media: media)
  end

  it 'is video or audio by its file, and must match what it says it is', :aggregate_failures do
    expect(build('set.mp4')).to have_attributes(media: 'video', content_type: 'video/mp4')
    expect(build('set.m4a')).to have_attributes(media: 'audio', content_type: 'audio/mp4')
    expect(build('set.m4a', media: 'video')).to_not be_valid
    expect(build('set.mp4', media: 'sound')).to_not be_valid
  end

  describe '#pair_with_other_file!' do
    it 'links the two files of one recording', :aggregate_failures do
      video = build('set.mp4').tap(&:save!)
      audio = build('set.m4a').tap(&:save!)

      audio.pair_with_other_file!

      expect(audio.reload.pair).to eq video
      expect(video.reload.pair).to eq audio
    end

    it 'does not pair two videos, or a file from long ago', :aggregate_failures do
      old_audio = build('old.m4a').tap(&:save!)
      old_audio.update_column(:created_at, 3.hours.ago)
      build('one.mp4').tap(&:save!)
      second = build('two.mp4').tap(&:save!)

      second.pair_with_other_file!

      expect(second.reload.pair).to be_nil
    end
  end

  describe '#complete!' do
    it 'queues the draft set for a live set’s audio only', :aggregate_failures do
      audio = build('set.m4a').tap(&:save!)
      video = build('set.mp4').tap(&:save!)

      video.complete!(size: 10)
      audio.complete!(size: 10)

      expect(Booth::LiveRecordingSetWorker).to have_enqueued_sidekiq_job(audio.id)
      expect(Booth::LiveRecordingSetWorker).to_not have_enqueued_sidekiq_job(video.id)
    end
  end
end
