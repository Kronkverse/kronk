# frozen_string_literal: true

class NudgeMessage < ApplicationRecord
  include Searchable

  searchable_as :nudge_messages

  belongs_to :notification
  belongs_to :media_attachment, optional: true
  belongs_to :voice_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :in_reply_to_notification, class_name: 'Notification', optional: true

  # A nudge is a short note attached to a poke, not a letter — but 100 words
  # was tight enough that real messages hit it. Raised to 1,000 on 2026-09-13:
  # the longest Mastodon-era private post on the live instance is 869 words,
  # so this is "long enough that nobody who has actually written to somebody
  # on Kronk would have been cut off", with headroom.
  #
  # The messenger proper (Nudges::ConversationMessage) has never had a word
  # limit. This one governs the nudge-compose modal from a profile.
  MAX_WORDS = 1_000

  def as_json_for_search
    {
      id: id,
      body: body.to_s,
      account_id: notification&.account_id,
      nudge_id: notification_id,
      created_at: created_at&.to_i,
    }
  end

  validate :word_count_within_limit

  private

  def word_count_within_limit
    return if body.blank?

    errors.add(:body, "exceeds #{MAX_WORDS} word limit") if body.split.size > MAX_WORDS
  end
end
