# frozen_string_literal: true

# Multi-attachment support. `media_attachment_id` (singular) stays for
# backward-compat with rows shipped in Phase 1i; the serializer reads
# both and emits a unified `media: []` array. New writes use the
# array column exclusively.
#
# Cap enforced at the model level (MAX_MEDIA = 4, matching Mastodon
# Status).
class AddMediaAttachmentIdsToNudgesConversationMessages < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :nudges_conversation_messages, :media_attachment_ids, :bigint, array: true, default: [], null: false
    end
  end
end
