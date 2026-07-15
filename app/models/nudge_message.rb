# frozen_string_literal: true

class NudgeMessage < ApplicationRecord
  include Searchable

  searchable_as :nudge_messages

  belongs_to :notification
  belongs_to :media_attachment, optional: true
  belongs_to :voice_attachment, class_name: 'MediaAttachment', optional: true
  belongs_to :in_reply_to_notification, class_name: 'Notification', optional: true

  MAX_WORDS = 100

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
