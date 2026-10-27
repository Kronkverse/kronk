# frozen_string_literal: true

# Queued when a live set's audio recording is complete
# (CallRecording#complete!): downloads it and makes the host's draft set
# (Booth::LiveRecordingSet). On the `pull` queue with the other jobs that
# fetch media, since a long set is a big file.
class Booth::LiveRecordingSetWorker
  include Sidekiq::Worker

  sidekiq_options queue: 'pull', retry: 5

  def perform(call_recording_id)
    recording = CallRecording.find_by(id: call_recording_id)
    return unless recording&.ready? && recording.audio? && recording.booth_live

    Booth::LiveRecordingSet.new(recording).call
  end
end
