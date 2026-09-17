# frozen_string_literal: true

# Bring the Kuestions v1 content into the v2 models.
#
# v1 stored a question as a Status with `post_type: question` and each answer
# as a reply Status with `post_type: answer`. v2 has dedicated `questions` and
# `answers` tables, because "answer before you can read the answers" cannot be
# enforced when an answer is just a public reply. `CreateQuestions` made the
# new tables and nothing ever filled them, so on an instance with v1 history
# the space opens empty while the old questions sit in the feed as ordinary
# posts, no longer even drawn as questions — the Status-polymorphic card was
# retired in alpha.297.
#
# The live instance has four questions and ten answers. Small, and worth
# keeping: it is the difference between a space that opens with history in it
# and one that opens blank.
#
# What this does NOT do is hide the originals. A v2 answer has no Status of
# its own, so hiding the old replies would be the only way to stop the same
# answer being readable in two places — but those replies are part of a thread
# people actually had, and blanking nine replies out of an existing
# conversation to tidy up a gate is worse than the inconsistency. The old
# posts stay where they are and are linked to the new rows, so:
#
#   - a question keeps its post, which now renders as a proper Kuestions card
#     rather than a plain status;
#   - an answer keeps its reply, and gains a row inside Kuestions.
#
# Visibility is taken from the Status as it stands at this point in the run —
# after `FoldRetiredVisibilities` — so an answer and its post always agree
# about who can see it.
#
# Idempotent: a question already carrying a `questions` row is skipped, and
# answers are matched on (question, account), which is uniquely indexed.
class ImportLegacyKuestions < ActiveRecord::Migration[8.0]
  QUESTION_POST_TYPE = 1
  ANSWER_POST_TYPE   = 2
  TITLE_LIMIT        = 240

  # Status visibility integer → the Answer reach vocabulary. Anything not
  # listed (the Mastodon tiers, all folded away by now) falls back to the
  # narrowest, because guessing wide is the mistake that cannot be undone.
  SCOPES = { 0 => 'public', 6 => 'mates', 7 => 'orbit', 8 => 'self_only' }.freeze

  class MigratedStatus < ApplicationRecord
    self.table_name = 'statuses'
  end

  class MigratedQuestion < ApplicationRecord
    self.table_name = 'questions'
  end

  class MigratedAnswer < ApplicationRecord
    self.table_name = 'answers'
  end

  def up
    return unless table_exists?(:questions) && table_exists?(:answers)

    questions = 0
    answers   = 0

    MigratedStatus.where(post_type: QUESTION_POST_TYPE).order(:id).each do |status|
      question_id = import_question(status)
      next unless question_id

      questions += 1

      MigratedStatus.where(post_type: ANSWER_POST_TYPE, in_reply_to_id: status.id).order(:id).each do |reply|
        answers += 1 if import_answer(question_id, reply)
      end
    end

    # A reply marked as an answer whose parent is not one of the questions —
    # a reply to another answer, or to a question since deleted. Left in the
    # feed, where it already reads as part of its thread.
    orphans = MigratedStatus
              .where(post_type: ANSWER_POST_TYPE)
              .where.not(in_reply_to_id: MigratedStatus.where(post_type: QUESTION_POST_TYPE).select(:id))
              .count

    say "imported #{questions} questions and #{answers} answers " \
        "(#{orphans} answer posts had no matching question and were left alone)"
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
          'Questions and answers created here are indistinguishable from ones ' \
          'posted since. Restore from backup.'
  end

  private

  def import_question(status)
    existing = MigratedQuestion.where(status_id: status.id).pick(:id)
    return existing if existing

    MigratedQuestion.create!(
      title: title_for(status),
      created_by_account_id: status.account_id,
      status_id: status.id,
      answer_format: 'text',
      mc_options: [],
      locked: false,
      created_at: status.created_at,
      updated_at: status.created_at
    ).id
  end

  def import_answer(question_id, reply)
    return false if MigratedAnswer.exists?(question_id: question_id, account_id: reply.account_id)
    return false if body_for(reply).blank?

    MigratedAnswer.create!(
      question_id: question_id,
      account_id: reply.account_id,
      body: body_for(reply),
      status_id: reply.id,
      visibility_scope: SCOPES.fetch(reply.visibility, 'self_only'),
      edit_history: [],
      created_at: reply.created_at,
      updated_at: reply.created_at
    )
    true
  end

  # A v1 question was the whole post; a v2 question has a title of at most
  # 240 characters. Long ones are cut rather than dropped — the full text is
  # still one tap away in the post the question is linked to.
  def title_for(status)
    plain = ActionController::Base.helpers.strip_tags(status.text.to_s).squish
    plain = 'Untitled question' if plain.blank?
    plain.truncate(TITLE_LIMIT)
  end

  def body_for(reply)
    ActionController::Base.helpers.strip_tags(reply.text.to_s).squish
  end
end
