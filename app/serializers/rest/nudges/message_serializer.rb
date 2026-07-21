# frozen_string_literal: true

# REST::Nudges::MessageSerializer — one message in a conversation
# stream. `author_is_self` is computed relative to `scope` (the
# current viewer) so the client can distinguish out/in bubbles
# without hitting `me` from the store.
class REST::Nudges::MessageSerializer < ActiveModel::Serializer
  attributes :id, :conversation_id, :body, :media, :voice,
             :reactions, :created_at, :author_is_self, :author

  def id
    object.id.to_s
  end

  def conversation_id
    object.conversation_id.to_s
  end

  # Compact media payload for the client: url + type + preview so the
  # bubble can render without a follow-up fetch. Nil when the message
  # has no attachment.
  def media
    attachment = object.media_attachment
    return nil unless attachment

    {
      id: attachment.id.to_s,
      type: attachment.type,
      url: attachment.file&.url(:original),
      preview_url: attachment.file&.url(attachment.file.styles.keys.first || :original),
      description: attachment.description,
    }
  end

  def voice
    attachment = object.voice_attachment
    return nil unless attachment

    {
      id: attachment.id.to_s,
      url: attachment.file&.url(:original),
      duration: attachment.file_meta&.dig('duration'),
    }
  end

  def created_at
    object.created_at.iso8601
  end

  def author_is_self
    scope.present? && object.author_account_id == scope.id
  end

  def author
    REST::AccountSerializer.new(object.author_account).as_json
  end
end
