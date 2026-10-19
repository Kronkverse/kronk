# frozen_string_literal: true

# Nudges::PushPayload — what a phone shows for a nudge: who, in that
# space's words ("Ana sent you a rose", "Ana nudged you"), and where a tap
# goes. A chat message says who wrote, never what (Tal 2026-10-19), so
# nothing private sits on a lock screen. Copy: config/locales/kronk/
# overrides.yml `nudges.push`, kept in step with the Notifications face
# (features/nudges_messenger/notification_copy.ts).
class Nudges::PushPayload
  include RoutingHelper

  def initialize(record, recipient:)
    @record = record
    @recipient = recipient
  end

  def as_json(*)
    {
      kronk_nudge: true,
      title: title,
      body: body,
      icon: full_asset_url(actor.avatar_static_url),
      url: url,
      tag: tag,
      timestamp: @record.created_at.iso8601,
      preferred_locale: I18n.locale.to_s,
    }
  end

  private

  def message?
    @record.is_a?(Nudges::ConversationMessage)
  end

  def actor
    message? ? @record.author_account : @record.actor_account
  end

  def who
    actor.display_name.presence || actor.username
  end

  def title
    return message_title if message?

    I18n.t("nudges.push.#{@record.source_korner_slug}.#{@record.verb}", who: who, default: fallback_title)
  end

  def message_title
    krew = @record.conversation.krew
    return I18n.t('nudges.push.message.mate', who: who) unless krew

    I18n.t('nudges.push.message.krew', who: who, krew: krew.name)
  end

  # An invite reads the same whichever space it is to; anything else this
  # file has no sentence for names the space.
  def fallback_title
    return I18n.t('nudges.push.space_invited', who: who) if @record.verb == 'invited'

    korner = Kronk::KornerRegistry.find(@record.source_korner_slug)&.name || @record.source_korner_slug.to_s.titleize
    I18n.t('nudges.push.generic', who: who, korner: korner)
  end

  # What the notification is about (an album, a proposal), when it has a name.
  def body
    return nil if message?

    subjects.title_for(@record)
  end

  def url
    return "/nudges/#{@record.conversation_id}" if message?

    subjects.route_for(@record)
  end

  # One per chat, so a run of messages replaces itself instead of stacking.
  def tag
    message? ? "nudges-chat-#{@record.conversation_id}" : "nudge-#{@record.id}"
  end

  def subjects
    @subjects ||= Nudges::NotificationSubjects.new([@record], viewer: @recipient)
  end
end
