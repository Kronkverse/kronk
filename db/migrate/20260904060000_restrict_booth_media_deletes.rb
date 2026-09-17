# frozen_string_literal: true

# Booth's media foreign keys were `ON DELETE SET NULL`: deleting a
# MediaAttachment a BoothSet pointed at silently blanked the pointer and left
# a set with a title, an artist and no music. That is how a manual orphan
# sweep on 2026-08-04 emptied a Booth set without anything raising — the same
# sweep hit a Moment and stopped dead, because `moments.media_attachment_id`
# refuses the delete instead.
#
# This brings Booth in line with Moments: a delete that would strand a set is
# refused, so the mistake becomes a loud error rather than quiet data loss.
#
# Legitimate deletes are unaffected. Removing a BoothSet still works (the
# constraint is on the referencing row, not the referenced one), and account
# deletion now clears korner-owned media references before purging media —
# see `DeleteAccountService#purge_korner_media_owners!`, without which this
# change would break deleting any account that had posted to the Booth.
class RestrictBoothMediaDeletes < ActiveRecord::Migration[8.0]
  # Required by strong_migrations: `validate_foreign_key` takes a lock that
  # blocks writes, so it must not run inside the migration's transaction.
  disable_ddl_transaction!

  def up
    # Swapping a foreign key's delete behaviour means dropping and re-adding
    # it. `validate: false` then a separate `validate_foreign_key` keeps the
    # re-add from taking a long table lock while it verifies existing rows;
    # `booth_sets` is tiny today, but the pattern costs nothing and is what
    # strong_migrations asks for.
    %w(audio_attachment_id cover_attachment_id).each do |column|
      remove_foreign_key :booth_sets, column: column

      add_foreign_key :booth_sets, :media_attachments, column: column, on_delete: :restrict, validate: false
      validate_foreign_key :booth_sets, column: column
    end
  end

  def down
    %w(audio_attachment_id cover_attachment_id).each do |column|
      remove_foreign_key :booth_sets, column: column

      add_foreign_key :booth_sets, :media_attachments, column: column, on_delete: :nullify, validate: false
      validate_foreign_key :booth_sets, column: column
    end
  end
end
