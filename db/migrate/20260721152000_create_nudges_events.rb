# frozen_string_literal: true

# Nudges::Event — the inline system event that renders alongside
# messages in a conversation. NOT a message. A froth on a proposal
# lands here as { source_korner: 'kommons', verb: 'frothed', ... };
# the conversation stream interleaves events and messages by
# `created_at` desc.
#
# `source_type` + `source_id` is a polymorphic reference to the korner
# object (Status, Proposal, Event, …). Nudges stores the reference
# only — never a copy of the underlying data. When the source is
# tombstoned, the event tombstones with it via reader logic.
#
# `interaction`:
#   - interactive → reply-able in-context (a reply is the next message).
#   - passive     → deep-link only; no reply target.
class CreateNudgesEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :nudges_events do |t|
      t.references :conversation, null: false, foreign_key: { to_table: :nudges_conversations, on_delete: :cascade }
      t.references :actor_account, null: false, foreign_key: { to_table: :accounts, on_delete: :cascade }
      t.string     :source_korner_slug, null: false # 'kommons' | 'kalendar' | 'wachuneed' | ...
      t.string     :verb, null: false               # 'frothed' | 'backed' | 'rsvp' | 'joined' | 'boost' | 'mention' | 'event_updated' | ...
      t.string     :source_type                     # 'Status' | 'Proposal' | 'Event' | ...
      t.bigint     :source_id
      t.string     :interaction, null: false        # 'interactive' | 'passive'
      t.string     :cta_label                       # e.g. 'View proposal' (interactive only)
      t.string     :cta_route                       # e.g. '/hub/kommons/p/42'

      t.datetime :created_at, null: false
    end

    add_index :nudges_events, [:conversation_id, :created_at], order: { created_at: :desc }, name: 'index_nudges_events_on_convo_recency'
    add_index :nudges_events, [:source_type, :source_id], where: 'source_type IS NOT NULL AND source_id IS NOT NULL', name: 'index_nudges_events_on_source_ref'
  end
end
