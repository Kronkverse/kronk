# frozen_string_literal: true

# Some Kronk foreign keys had no ON DELETE rule, and the code paths that
# delete their parents use delete_all (no callbacks). So a parent with a
# child row could not be deleted at all:
#
# - an account that ever sent or received a nudge with text, photo or voice
#   (nudge_messages -> notifications) could not be deleted or cleanly
#   blocked, and "Clear notifications" failed for it;
# - an account that commented on a proposal, frothed a Moment or tagged a
#   photo could not be fully destroyed;
# - an unattached upload with a tag on it stopped the nightly media cleanup
#   for its whole batch (it has failed nightly on production since at least
#   2026-10-10).
#
# Each key now says what happens: the child goes with its parent, or (for a
# reply link or a voice clip) the link is cleared.
class LetDeletesThroughKornerForeignKeys < ActiveRecord::Migration[8.0]
  KEYS = [
    [:nudge_messages, :notifications, :notification_id, :cascade],
    [:nudge_messages, :notifications, :in_reply_to_notification_id, :nullify],
    [:nudge_messages, :media_attachments, :voice_attachment_id, :nullify],
    [:media_tags, :accounts, :account_id, :cascade],
    [:media_tags, :accounts, :created_by_account_id, :cascade],
    [:media_tags, :media_attachments, :media_attachment_id, :cascade],
    [:moment_froths, :accounts, :account_id, :cascade],
    [:proposal_comments, :accounts, :account_id, :cascade],
    [:proposal_comments, :proposal_comments, :parent_id, :nullify],
  ].freeze

  def up
    # Each swap takes a brief exclusive lock on two tables (accounts,
    # notifications and media_attachments among them). Give up after a few
    # seconds rather than queue the whole site behind a long query; the
    # deploy fails and can be rerun.
    safety_assured { execute "SET LOCAL lock_timeout = '5s'" }

    KEYS.each do |table, target, column, rule|
      remove_foreign_key table, column: column
      # Not re-validated: every existing row already satisfied the old key,
      # and validating under the migration lock is what strong_migrations
      # refuses. New rows are checked as before.
      add_foreign_key table, target, column: column, on_delete: rule, validate: false
    end
  end

  def down
    KEYS.each do |table, target, column, _rule|
      remove_foreign_key table, column: column
      add_foreign_key table, target, column: column
    end
  end
end
