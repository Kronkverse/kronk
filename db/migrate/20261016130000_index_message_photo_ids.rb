# frozen_string_literal: true

# The nightly media cleanup asks, for every unattached upload, whether any
# message lists it among its photos. Without an index that reads the whole
# messages table once per upload, so it slows as Messages grow. A GIN index
# answers `media_attachment_ids @> ARRAY[id]` directly
# (Vacuum::MediaAttachmentsVacuum).
class IndexMessagePhotoIds < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def change
    add_index :nudges_conversation_messages, :media_attachment_ids, using: :gin, algorithm: :concurrently
  end
end
