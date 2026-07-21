# frozen_string_literal: true

# REST::Nudges::ConversationSerializer — sidebar-shape summary for the
# conversation list. Includes the other account, last-activity time,
# unread count for the current viewer, a one-line preview, and the
# `latest_kind` (message | event | null) so the client can hint at
# waiting-item type before opening.
#
# Pass `scope: current_account` — the serializer needs it to compute
# per-viewer unread + orient "other party" for Mate.
class REST::Nudges::ConversationSerializer < ActiveModel::Serializer
  include RoutingHelper

  attributes :id, :kind, :last_activity_at, :expires_at, :unread_count,
             :preview, :latest_kind, :muted, :krew

  belongs_to :other_account, serializer: REST::AccountSerializer

  # Krew-only per-viewer mute state. Always false for Mate (no mute).
  def muted
    return false unless viewer

    object.muted_for?(viewer)
  end

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

  # Krew descriptor for kind=krew rows. Null for Mate. Includes up to
  # two member avatar URLs to render the stacked-pair thumbnail in the
  # sidebar per docs/kronk_nudges.md §Surface 2. Preference: (viewer
  # first if a member), then remaining members ordered by join time.
  def krew
    return nil unless object.krew?

    group = object.krew
    return nil unless group

    {
      id: group.id.to_s,
      name: group.name,
      member_count: group.group_memberships.count,
      avatar_urls: krew_avatar_urls(group),
    }
  end

  def krew_avatar_urls(group)
    ordered = group.group_memberships.order(:id).limit(4).map(&:account)
    ordered = [viewer] + ordered.reject { |a| a.id == viewer&.id } if viewer && ordered.any? { |a| a.id == viewer.id }
    ordered.first(2).map { |a| full_asset_url(a.avatar_original_url) }
  end

  def unread_count
    return 0 unless viewer

    object.unread_count_for(viewer)
  end

  def preview
    latest = latest_item
    return '' unless latest

    latest[:text]
  end

  def latest_kind
    latest_item&.dig(:kind)
  end

  private

  def viewer
    scope
  end

  # Cached across the two consumers (`preview` + `latest_kind`) so
  # the sidebar list isn't billed for a double DB round-trip per row.
  def latest_item
    @latest_item ||= begin
      latest_message = object.messages.order(id: :desc).first
      latest_event   = object.events.order(created_at: :desc).first

      candidates = []
      candidates << { kind: 'message', at: latest_message.created_at, text: message_preview(latest_message) } if latest_message
      candidates << { kind: 'event', at: latest_event.created_at, text: event_preview(latest_event) } if latest_event

      candidates.max_by { |c| c[:at] }
    end
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
