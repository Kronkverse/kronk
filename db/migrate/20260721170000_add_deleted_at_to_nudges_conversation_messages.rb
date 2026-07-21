# frozen_string_literal: true

# Tombstone-and-410 per docs/kronk_nudges.md non-negotiables. Soft
# delete keeps the row so the id stays claimed (IDs never reused);
# the serializer redacts body/media/reactions when `deleted_at` is
# present.
#
# `safety_assured` — this table is Kronk-local; adding a nullable
# column with an index is safe regardless of the strong_migrations
# gate here.
class AddDeletedAtToNudgesConversationMessages < ActiveRecord::Migration[8.0]
  def change
    safety_assured do
      add_column :nudges_conversation_messages, :deleted_at, :datetime
      add_index  :nudges_conversation_messages, :deleted_at, where: 'deleted_at IS NOT NULL'
    end
  end
end
