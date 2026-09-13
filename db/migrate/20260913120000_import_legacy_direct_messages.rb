# frozen_string_literal: true

# Move the Mastodon-era private posts into the messenger.
#
# Before Kronk had a messenger, a private message was a status with
# `visibility: direct` and the recipients in its mentions. 2.0 has
# `Nudges::Conversation` + `Nudges::ConversationMessage` instead, and the
# reach ladder has no room for `direct` — so these would otherwise be folded
# into some other tier and either widened to an audience that was never party
# to them or narrowed until the recipient loses them.
#
# On the live instance there are 161, spanning 2024-02 to a week before this
# was written, 110 of them replies. They are conversations, not residue.
#
# What this does, per status, oldest first:
#
#   1. Find the local accounts it was addressed to (its mentions, minus the
#      author, minus anyone remote — a conversation with a federated ghost
#      would be a dead end).
#   2. For each, find or create the 1:1 conversation between author and
#      recipient, and insert the message with the original text, timestamps
#      and up to `MAX_MEDIA` attachments.
#   3. Set the original status to `self_only`, so the content is preserved
#      for its author and visible to nobody else.
#
# Nothing is deleted. A status carrying more attachments than a message can
# hold keeps all of them in the original, which its author can still open.
#
# Deliberate omissions:
#
#   - A status addressed to more than one person becomes one message in each
#     of those conversations. The messenger is 1:1; a thread with three people
#     in it has nowhere else to go, and dropping the extra recipients would be
#     worse than duplicating.
#   - A status addressed to nobody (nine of them) has no conversation to join.
#     It just becomes self_only.
#   - Messages are inserted directly rather than through the model, so no
#     streaming pushes, notifications or milestone pins fire for a
#     conversation that happened years ago. Relationship counters are
#     adjusted afterwards in one statement, without touching
#     `last_milestone_hit` — importing history should not tell somebody they
#     have just hit 250 messages.
#
# Idempotent by construction: a status is set to self_only as it is imported,
# so a second run finds nothing.
class ImportLegacyDirectMessages < ActiveRecord::Migration[8.0]
  DIRECT     = 3
  SELF_ONLY  = 8
  MAX_MEDIA  = 5 # keep in step with Nudges::ConversationMessage::MAX_MEDIA

  class MigratedStatus < ApplicationRecord
    self.table_name = 'statuses'
  end

  class MigratedConversation < ApplicationRecord
    self.table_name = 'nudges_conversations'
  end

  class MigratedMessage < ApplicationRecord
    self.table_name = 'nudges_conversation_messages'
  end

  def up
    # `nudges_conversations` arrives with the messenger. If a deployment is
    # somehow missing it, do nothing rather than half-import.
    return unless table_exists?(:nudges_conversations) && table_exists?(:nudges_conversation_messages)

    imported = 0
    orphaned = 0
    pairs    = Hash.new(0)

    directs = MigratedStatus.where(visibility: DIRECT).order(:created_at, :id)

    directs.each do |status|
      recipients = recipients_for(status)

      if recipients.empty?
        orphaned += 1
      else
        media_ids = media_ids_for(status)

        recipients.each do |recipient_id|
          conversation_id = conversation_between(status.account_id, recipient_id, status.created_at)
          insert_message(conversation_id, status, media_ids)
          pairs[[status.account_id, recipient_id].sort] += 1
          imported += 1
        end
      end

      MigratedStatus.where(id: status.id).update_all(visibility: SELF_ONLY)
    end

    bump_relationships(pairs)

    say "imported #{imported} messages from #{directs.size} legacy direct statuses " \
        "(#{orphaned} had no local recipient and were left as self_only)"
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
          'Legacy direct statuses are now self_only and their contents also ' \
          'live in the messenger. Which is which cannot be told apart on the ' \
          'way back. Restore from backup.'
  end

  private

  # Local accounts mentioned on the status, minus the author. Remote
  # accounts are skipped: a 1:1 conversation with an account on another
  # server is not something the messenger can carry.
  def recipients_for(status)
    select_values(<<~SQL.squish)
      SELECT DISTINCT mentions.account_id
      FROM mentions
      JOIN accounts ON accounts.id = mentions.account_id
      WHERE mentions.status_id = #{status.id.to_i}
        AND accounts.domain IS NULL
        AND mentions.account_id <> #{status.account_id.to_i}
    SQL
  end

  def media_ids_for(status)
    select_values(<<~SQL.squish)
      SELECT id FROM media_attachments
      WHERE status_id = #{status.id.to_i}
      ORDER BY id
      LIMIT #{MAX_MEDIA}
    SQL
  end

  # The mate conversation for a pair, created if this is the first message
  # between them. Pair is stored sorted, matching
  # Nudges::Conversation.mate_between!.
  #
  # A conversation created here is dated from the message that created it,
  # not from the import — otherwise every migrated thread would arrive at the
  # top of the sidebar claiming to be today's news.
  def conversation_between(one_id, two_id, at)
    a_id, b_id = [one_id, two_id].sort
    existing = MigratedConversation.where(kind: 'mate', account_a_id: a_id, account_b_id: b_id).pick(:id)
    return existing if existing

    MigratedConversation.create!(
      kind: 'mate',
      account_a_id: a_id,
      account_b_id: b_id,
      last_activity_at: at,
      created_at: at,
      updated_at: at
    ).id
  end

  def insert_message(conversation_id, status, media_ids)
    MigratedMessage.create!(
      conversation_id: conversation_id,
      author_account_id: status.account_id,
      body: status.text.presence,
      media_attachment_ids: media_ids,
      created_at: status.created_at,
      updated_at: status.created_at
    )

    # The sidebar sorts on this, so an imported conversation should surface
    # at the age of its newest message rather than at the moment of import.
    MigratedConversation
      .where(id: conversation_id)
      .where('last_activity_at IS NULL OR last_activity_at < ?', status.created_at)
      .update_all(last_activity_at: status.created_at)
  end

  # One row per pair, counting what was imported. `last_milestone_hit` is
  # left alone deliberately — see the header.
  # `safety_assured` because strong_migrations cannot see inside an execute.
  # This is an upsert of one small row per pair — no locks worth the name.
  def bump_relationships(pairs)
    pairs.each do |(a_id, b_id), count|
      safety_assured do
        execute(<<~SQL.squish)
          INSERT INTO nudges_relationships (account_a_id, account_b_id, message_count, last_milestone_hit, created_at, updated_at)
          VALUES (#{a_id.to_i}, #{b_id.to_i}, #{count.to_i}, 0, now(), now())
          ON CONFLICT (account_a_id, account_b_id)
          DO UPDATE SET message_count = nudges_relationships.message_count + #{count.to_i},
                        updated_at = now()
        SQL
      end
    end
  end
end
