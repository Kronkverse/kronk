# frozen_string_literal: true

# Voice-only Moments: a Moment may now carry a voice clip with no photo
# or video. Relax the NOT NULL on media_attachment_id — the model's
# `media_present_or_voice` validation guarantees a Moment is never
# empty (it must still have a photo/video OR a voice clip). Existing
# rows all have a media_attachment, so relaxing the constraint touches
# no data.
class AllowVoiceOnlyMoments < ActiveRecord::Migration[8.0]
  def up
    change_column_null :moments, :media_attachment_id, true
  end

  def down
    change_column_null :moments, :media_attachment_id, false
  end
end
