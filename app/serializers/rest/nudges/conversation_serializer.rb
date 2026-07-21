# frozen_string_literal: true

# REST::Nudges::ConversationSerializer — sidebar-shape summary for the
# conversation list. Includes the other account, last-activity time,
# unread count for the current viewer, and a one-line preview
# (message body or event verb).
#
# Pass `scope: current_account` — the serializer needs it to compute
# per-viewer unread + orient "other party" for Mate.
class REST::Nudges::ConversationSerializer < ActiveModel::Serializer
  attributes :id, :kind, :last_activity_at, :expires_at, :unread_count, :preview

  belongs_to :other_account, serializer: REST::AccountSerializer

  def id
    object.id.to_s
  end

  def last_activity_at
    object.last_activity_at&.iso8601
  end

  def expires_at
    object.expires_at&.iso8601
  end

  def other_account
    return nil unless viewer

    object.other_account_for(viewer)
  end

  def unread_count
    return 0 unless viewer

    object.unread_count_for(viewer)
  end

  # One-line preview: the latest of (message body, event verb),
  # whichever has the newer created_at. Attachment-only messages fall
  # back to a type label; events fall back to a compact verb.
  def preview
    latest_message = object.messages.order(id: :desc).first
    latest_event   = object.events.order(created_at: :desc).first

    candidates = []
    candidates << { at: latest_message.created_at, text: message_preview(latest_message) } if latest_message
    candidates << { at: latest_event.created_at, text: event_preview(latest_event) } if latest_event

    candidates.max_by { |c| c[:at] }&.dig(:text) || ''
  end

  private

  def viewer
    scope
  end

  def message_preview(message)
    return message.body.to_s.truncate(80) if message.body.present?
    return '📷 photo' if message.media_attachment_id.present?
    return '🎙️ voice' if message.voice_attachment_id.present?

    ''
  end

  def event_preview(event)
    "#{event.actor_account.display_name.presence || event.actor_account.username} #{event.verb}"
  end
end
