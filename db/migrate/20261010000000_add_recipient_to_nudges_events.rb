# frozen_string_literal: true

# Notifications get a home of their own (docs/decisions.md, 2026-10-10). Until
# now a nudge event had no recipient: it was a line in the Mate chat between
# the actor and whoever it was for, so "who is this for" could only be worked
# out from the chat it sat in, and it could only be listed one chat at a time.
#
# `recipient_account_id` says who the event is addressed to, and `seen_at`
# is when they saw it in the notifications list (nil = unseen). A timestamp
# rather than a read pointer because an aggregated burst re-floats an existing
# row (`Nudges::EventRouter#collapse_onto`) — its id does not move, so an
# id-based pointer never sees it come back.
#
# Events that belong to a chat rather than to a person (a Krew join line, a
# Mate message milestone) keep a nil recipient.
#
# Structured for strong_migrations: plain `add_column`, a concurrent partial
# index, and the foreign key added unvalidated then validated.
class AddRecipientToNudgesEvents < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  INDEX_NAME = 'index_nudges_events_on_recipient_recency'

  def up
    add_column :nudges_events, :recipient_account_id, :bigint, if_not_exists: true
    add_column :nudges_events, :seen_at, :datetime, if_not_exists: true

    add_index :nudges_events, [:recipient_account_id, :created_at],
              name: INDEX_NAME,
              order: { created_at: :desc },
              where: 'recipient_account_id IS NOT NULL',
              algorithm: :concurrently,
              if_not_exists: true

    add_foreign_key :nudges_events, :accounts, column: :recipient_account_id, on_delete: :cascade, validate: false unless recipient_foreign_key?
    validate_foreign_key :nudges_events, :accounts, column: :recipient_account_id

    backfill_recipients
  end

  def down
    remove_foreign_key :nudges_events, :accounts, column: :recipient_account_id, if_exists: true
    remove_index :nudges_events, name: INDEX_NAME, algorithm: :concurrently, if_exists: true
    remove_column :nudges_events, :seen_at, if_exists: true
    remove_column :nudges_events, :recipient_account_id, if_exists: true
  end

  private

  def recipient_foreign_key?
    foreign_key_exists?(:nudges_events, :accounts, column: :recipient_account_id)
  end

  # Existing events in a Mate chat were addressed to the participant who is
  # not the actor. Carry the read state over too: an event at or below that
  # participant's event pointer has already been seen. Milestones are about
  # the pair, not addressed to one of them, so they are left alone.
  def backfill_recipients
    safety_assured do
      execute(<<~SQL.squish)
        UPDATE nudges_events e
        SET recipient_account_id = CASE WHEN c.account_a_id = e.actor_account_id THEN c.account_b_id ELSE c.account_a_id END,
            seen_at = CASE
              WHEN e.id <= COALESCE(CASE WHEN c.account_a_id = e.actor_account_id THEN c.last_read_event_id_b ELSE c.last_read_event_id_a END, 0)
              THEN e.created_at
            END
        FROM nudges_conversations c
        WHERE c.id = e.conversation_id
          AND c.kind = 'mate'
          AND e.recipient_account_id IS NULL
          AND left(e.verb, 10) <> 'milestone_'
      SQL
    end
  end
end
