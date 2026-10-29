# frozen_string_literal: true

require 'tmpdir'

# A live set's audio recording, made into a draft set for its host
# (docs/spaces/booth.md, Recording a live set). Unpublished, kind
# `live_recording`, with the live set's title, description and genres, its
# start as the event date, and the host's Now playing as the track list.
# The live set has no cover or co-hosts of its own, so the set has none; the
# host is its artist, as for any upload.
#
# A set's audio is a MediaAttachment (BoothSet#audio_attachment), and a
# MediaAttachment's file has to pass through Paperclip, which transcodes
# audio to MP3 the way every uploaded set is (MediaAttachment::AUDIO_STYLES)
# and reads its length. So the recording is downloaded to a temporary file
# and attached like an upload, in a job (Booth::LiveRecordingSetWorker), not
# copied object to object in storage: a copied object would skip the
# transcode, the metadata and the media path Paperclip expects.
#
# Once per live set: `booth_lives.booth_set_id` says it's done. The host is
# nudged ("Your live set is ready to publish").
class Booth::LiveRecordingSet
  KORNER = 'booth'
  VERB = 'set_ready'

  def initialize(recording)
    @recording = recording
    @live = recording.booth_live
  end

  def call
    return @live.booth_set if @live.booth_set.present?

    media = attach_audio
    set = nil
    made = false
    @live.with_lock do
      if @live.booth_set_id.nil?
        set = build_set(media)
        set.save!
        @live.update!(booth_set: set)
        made = true
      end
    end

    if made
      notify(set)
      set
    else
      # Another run got there first.
      media.destroy
      @live.reload.booth_set
    end
  end

  private

  def attach_audio
    Dir.mktmpdir('booth-live-recording') do |dir|
      path = File.join(dir, @recording.filename)
      Kronk::CallRecordingStorage.download(@recording.storage_key, path)
      File.open(path, 'rb') do |file|
        MediaAttachment.create!(account: @live.account, file: file)
      end
    end
  end

  def build_set(media)
    BoothSet.new(
      account: @live.account,
      title: @live.title.truncate(200),
      description: @live.description.to_s.truncate(5000),
      genres: Array(@live.genres).first(10),
      kind: 'live_recording',
      published: false,
      audio_attachment: media,
      duration_seconds: duration(media),
      event_date: @live.started_at,
      tracklist: @live.tracklist
    ).tap { |set| set.artist_name = set.credit_line }
  end

  def duration(media)
    seconds = media.file.meta&.dig('original', 'duration') || @recording.duration
    seconds&.to_f&.round
  end

  def notify(set)
    Nudges::Event.create!(
      actor_account: nil,
      recipient_account: @live.account,
      source_korner_slug: KORNER,
      verb: VERB,
      source_type: 'BoothSet',
      source_id: set.id,
      interaction: 'interactive',
      cta_label: 'Publish',
      cta_route: "/hub/booth/sets/#{set.id}"
    )
  end
end
