# frozen_string_literal: true

# Kronk — give every local account that has posted a photo or video a
# Gallery shelf at the top of its profile (docs/spaces/profile.md, The
# Gallery). From here on `PostStatusService` adds it on someone's first
# photo or video; this covers everyone who posted one before.
#
# **Idempotent.** An account that already has a Gallery row (shown or taken
# off) is left alone, so re-running is a no-op and an owner who took theirs
# off is never given it back.
#
# The query is spelled out here rather than calling
# `ProfileSection.gallery_statuses`, so the migration keeps meaning what it
# meant when it ran. It only decides who gets a shelf; what the shelf shows
# is resolved at read time.
class BackfillProfileGalleryShelves < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  GALLERY_SETTINGS = { 'render' => 'photo', 'korner_slug' => 'profile', 'source' => 'media', 'order' => 'newest' }.freeze

  # MediaAttachment types: image 0, gifv 1, video 2. Status post_type normal 0.
  POSTERS_SQL = <<~SQL.squish
    SELECT DISTINCT statuses.account_id
    FROM statuses
    JOIN media_attachments ON media_attachments.status_id = statuses.id
    JOIN accounts ON accounts.id = statuses.account_id
    WHERE accounts.domain IS NULL
      AND statuses.deleted_at IS NULL
      AND statuses.reblog_of_id IS NULL
      AND statuses.reply = FALSE
      AND statuses.post_type = 0
      AND media_attachments.type IN (0, 1, 2)
  SQL

  def up
    [Account, ProfileSection].each(&:reset_column_information)

    account_ids = select_values(POSTERS_SQL)
    Account.where(id: account_ids).find_each(batch_size: 100) do |account|
      next if account.profile_sections.any? { |s| s.settings.is_a?(Hash) && s.settings['source'] == 'media' }

      safety_assured do
        ProfileSection.transaction do
          account.profile_sections.update_all('position = position + 1')
          account.profile_sections.create!(section_type: 'drawn', position: 0, visible: true, title: 'Gallery',
                                           settings: GALLERY_SETTINGS.dup, visibility: 'public')
        end
      end
    end
  end

  def down
    # The rows can't be told apart from a Gallery the owner has since
    # arranged; leave them.
    raise ActiveRecord::IrreversibleMigration
  end
end
