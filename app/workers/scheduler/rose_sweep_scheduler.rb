# frozen_string_literal: true

# Deletes roses from days that have ended. Nothing is kept after the 3am
# Sydney boundary — no history, no totals, no row — so this is the whole
# of the feature's retention policy (docs/spaces/rose.md).
#
# Correctness does not depend on this running on time: the read path
# already asks only for the current Kronk day, so a missed sweep leaves
# rows nobody can see rather than yesterday's roses on someone's screen.
# That is deliberate — a cron that quietly stops should not change what
# people see.
class Scheduler::RoseSweepScheduler
  include Sidekiq::Worker

  sidekiq_options retry: 0

  def perform
    Rose.where(sent_on: ...Rose.current_day).in_batches.delete_all
  end
end
