# frozen_string_literal: true

# A ready call recording, for someone allowed to see it
# (Api::V1::Calls::RecordingsController). `url` plays it and `download_url`
# saves it: both signed and short-lived, never a public object. `can_delete`
# is the viewer's own.
class REST::CallRecordingSerializer < ActiveModel::Serializer
  attributes :id, :kind, :created_at, :duration, :size, :filename,
             :content_type, :url, :download_url, :can_delete

  def id
    object.id.to_s
  end

  def created_at
    object.created_at.iso8601
  end

  def url
    Kronk::CallRecordingStorage.play_url(object.storage_key, object.content_type)
  end

  def download_url
    Kronk::CallRecordingStorage.download_url(object.storage_key, object.filename)
  end

  def can_delete
    instance_options[:can_delete] || false
  end
end
