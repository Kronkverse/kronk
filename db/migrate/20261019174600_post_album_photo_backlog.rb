# frozen_string_literal: true

# The photos added to albums before 2026-10-19 get their feed posts too, one
# per burst, each dated when the burst happened so it sits in feeds at that
# point and not at the top (Tal: "so Ash's 20 odd photos are presented in
# the new way"). Safe to re-run: photos already in a batch are skipped.
class PostAlbumPhotoBacklog < ActiveRecord::Migration[8.0]
  # The posts are fanned out by queued jobs, which must find them committed.
  disable_ddl_transaction!

  def up
    Albutts::PublishPhotoBatch.backlog_all!
  end

  def down
    # The posts may have froths and replies by now; leave them.
  end
end
