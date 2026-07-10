# frozen_string_literal: true

# Kuestions v2 backfill. Walks Status rows with the legacy discriminator
# (post_type=question / post_type=answer) and creates matching Question /
# Answer records linked via status_id per §5.5. Reply-thread structure
# on Statuses maps to answers' question_id.
#
# Idempotent — skips Statuses already backfilled (Question or Answer row
# already exists with that status_id). Supports dry-run.
#
# Usage:
#   RAILS_ENV=production bundle exec rake kronk:kuestions:backfill
#   RAILS_ENV=production DRY_RUN=1 bundle exec rake kronk:kuestions:backfill
#
# Run against shadow first; verify counts and spot-check a few records
# before running against production.

namespace :kronk do
  namespace :kuestions do
    desc 'Backfill Question and Answer rows from post_type=question|answer Statuses'
    task backfill: :environment do
      dry_run = ENV['DRY_RUN'] == '1'
      report = { questions: 0, answers: 0, skipped_status_orphans: 0, skipped_existing: 0 }

      say_and_log = ->(msg) { puts "[kronk:kuestions:backfill] #{msg}" }
      say_and_log.call("starting (dry_run=#{dry_run})")

      # Questions first — answers reference them.
      Status.unscoped.where(post_type: :question).find_each do |status|
        if Question.exists?(status_id: status.id)
          report[:skipped_existing] += 1
          next
        end

        attrs = {
          status_id:             status.id,
          created_by_account_id: status.account_id,
          title:                 (status.text || status.spoiler_text.to_s).to_s[0, 240].presence || '(untitled)',
          prompt:                status.text,
          created_at:            status.created_at,
          updated_at:            status.updated_at,
        }

        if dry_run
          say_and_log.call("would create Question(status_id=#{status.id}, title=#{attrs[:title].inspect})")
        else
          Question.create!(attrs)
        end
        report[:questions] += 1
      end

      # Answers next. Legacy answers are Status rows with post_type=answer
      # and in_reply_to_id pointing at the parent question status.
      Status.unscoped.where(post_type: :answer).find_each do |status|
        if Answer.exists?(status_id: status.id)
          report[:skipped_existing] += 1
          next
        end

        parent_question = Question.find_by(status_id: status.in_reply_to_id)
        unless parent_question
          report[:skipped_status_orphans] += 1
          say_and_log.call("skipping answer status_id=#{status.id} — no Question row for in_reply_to_id=#{status.in_reply_to_id}")
          next
        end

        attrs = {
          question_id: parent_question.id,
          account_id:  status.account_id,
          body:        (status.text || '').to_s,
          status_id:   status.id,
          created_at:  status.created_at,
          updated_at:  status.updated_at,
        }

        if dry_run
          say_and_log.call("would create Answer(status_id=#{status.id}, question_id=#{parent_question.id})")
        else
          begin
            Answer.create!(attrs)
          rescue ActiveRecord::RecordInvalid => e
            say_and_log.call("skipping answer status_id=#{status.id} — validation failed: #{e.message}")
            report[:skipped_status_orphans] += 1
            next
          end
        end
        report[:answers] += 1
      end

      puts ''
      puts "Questions: #{report[:questions]}"
      puts "Answers:   #{report[:answers]}"
      puts "Skipped (already backfilled):    #{report[:skipped_existing]}"
      puts "Skipped (orphan / invalid):      #{report[:skipped_status_orphans]}"
      puts ''
      puts dry_run ? 'DRY RUN — no rows written.' : 'Backfill complete.'
    end
  end
end
