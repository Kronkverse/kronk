# frozen_string_literal: true

# REST::Nudges::MessageSerializer — one message in a conversation
# stream. `author_is_self` is computed relative to `scope` (the
# current viewer) so the client can distinguish out/in bubbles
# without hitting `me` from the store.
#
# Tombstoned messages redact body / media / reactions; the client
# renders a "message deleted" placeholder.
class REST::Nudges::MessageSerializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :id, :conversation_id, :body, :media, :voice,
             :reactions, :created_at, :deleted, :deleted_at,
             :author_is_self, :author

  def id
    object.id.to_s
  end

  def conversation_id
    object.conversation_id.to_s
  end

  def body
    object.tombstoned? ? nil : object.body
  end

  # Compact media payload for the client: url + type + preview so the
  # bubble can render without a follow-up fetch. Always an array so
  # single-vs-multi doesn't require two code paths on the client.
  # Empty when the message has no attachments or is tombstoned.
  #
  # The urls follow REST::MediaAttachmentSerializer. A message used to
  # send the original file as its preview whatever it was, so a sound
  # sent from "File" came back as an mp3 for the chat to draw as a
  # picture, and a video still being processed pointed at a file that
  # wasn't there yet: both showed as a broken image. Now the preview is
  # only ever a picture (the small still, or a cover), `url` is nil until
  # the file is ready, and `processing` says whether it's on its way.
  def media
    return [] if object.tombstoned?

    object.media_attachments_all.map do |attachment|
      {
        id: attachment.id.to_s,
        type: attachment.type,
        url: media_url(attachment),
        preview_url: media_preview_url(attachment),
        processing: attachment.not_processed? && !attachment.processing_failed?,
        description: attachment.description,
      }
    end
  end

  def voice
    return nil if object.tombstoned?

    attachment = object.voice_attachment
    return nil unless attachment

    {
      id: attachment.id.to_s,
      url: attachment.file&.url(:original),
      duration: attachment.file_meta&.dig('duration'),
    }
  end

  def reactions
    object.tombstoned? ? [] : object.reactions
  end

  def created_at
    object.created_at.iso8601
  end

  def deleted
    object.tombstoned?
  end

  def deleted_at
    object.deleted_at&.iso8601
  end

  def author_is_self
    scope.present? && object.author_account_id == scope.id
  end

  def author
    REST::AccountSerializer.new(object.author_account).as_json
  end

  private

  def media_url(attachment)
    return if attachment.not_processed? || attachment.file.blank?

    full_asset_url(attachment.file.url(:original))
  end

  def media_preview_url(attachment)
    return if attachment.not_processed?

    if attachment.thumbnail.present?
      full_asset_url(attachment.thumbnail.url(:original))
    elsif attachment.file.present? && attachment.file.styles.key?(:small)
      full_asset_url(attachment.file.url(:small))
    end
  end
end
