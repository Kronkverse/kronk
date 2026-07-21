# frozen_string_literal: true

# REST::Nudges::MessageSerializer — one message in a conversation
# stream. `author_is_self` is computed relative to `scope` (the
# current viewer) so the client can distinguish out/in bubbles
# without hitting `me` from the store.
class REST::Nudges::MessageSerializer < ActiveModel::Serializer
  attributes :id, :conversation_id, :body, :media_attachment_id,
             :voice_attachment_id, :reactions, :created_at,
             :author_is_self, :author

  def id
    object.id.to_s
  end

  def conversation_id
    object.conversation_id.to_s
  end

  def media_attachment_id
    object.media_attachment_id&.to_s
  end

  def voice_attachment_id
    object.voice_attachment_id&.to_s
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
