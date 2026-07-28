# frozen_string_literal: true

# Kuestions feed projection returns (docs/spaces/kuestions.md §Feed projection).
#
# The Status-polymorphic question_card was retired 2026-07-22 (alpha.297)
# and the dedicated `kuestions_card` — backed by the Question model —
# now takes its place. This migration walks every existing Question and
# gives it the Status projection it never got during the v2 cutover.
#
# Two cases:
#   (a) Question has no status_id — create a companion Status via
#       Kuestions::PublishQuestion (idempotent).
#   (b) Question has a status_id but the Status is missing
#       source_korner — stamp it now.
#
# Non-transactional so per-question failures don't take the whole run
# down; each failure is logged and skipped. Safe to re-run.
class BackfillKuestionsFeedProjection < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    Question.where(status_id: nil).find_each do |question|
      Kuestions::PublishQuestion.new(question).call
    rescue StandardError => e
      Rails.logger.error("Kuestions feed backfill failed for question #{question.id}: #{e.message}")
    end

    safety_assured do
      execute(<<~SQL.squish)
        UPDATE statuses
        SET    source_korner = 'kuestions'
        FROM   questions
        WHERE  questions.status_id = statuses.id
          AND  statuses.source_korner IS NULL
      SQL
    end
  end

  def down
    safety_assured do
      execute("UPDATE statuses SET source_korner = NULL WHERE source_korner = 'kuestions'")
    end
  end
end
