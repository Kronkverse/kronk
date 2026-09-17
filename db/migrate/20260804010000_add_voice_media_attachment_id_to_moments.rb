# frozen_string_literal: true

# Adds `voice_media_attachment_id` to `moments` so a Moment can pair
# an optional voice clip with its still photo (docs/spaces/moments.md
# — third media shape, added 2026-08-04). Nullable; enforced null at
# the model level when the primary media is a video (video carries
# its own audio track).
#
# Structured for strong_migrations:
#   * `add_column` + a separate concurrent partial index (same
#     pattern as `AlbuttsStatusBacked` #1028's `status_id` add) —
#     no `add_reference` shortcut, no table lock.
#   * `disable_ddl_transaction!` so the concurrent index can run.
#   * The FK is deliberately omitted for the same reason: the
#     column is a soft link (`optional: true` on the model).
class AddVoiceMediaAttachmentIdToMoments < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_column :moments, :voice_media_attachment_id, :bigint, if_not_exists: true

    add_index :moments, :voice_media_attachment_id,
              algorithm: :concurrently,
              where: 'voice_media_attachment_id IS NOT NULL',
              if_not_exists: true
  end

  def down
    remove_index :moments, :voice_media_attachment_id, algorithm: :concurrently, if_exists: true
    remove_column :moments, :voice_media_attachment_id, if_exists: true
  end
end
