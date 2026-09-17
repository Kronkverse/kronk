# frozen_string_literal: true

# Sweeps open Huddle Rooms that have been idle for
# `HuddleSession::ROOM_IDLE_RETIRE_AFTER` (6 months, per Tal's
# decision 2026-08-07 — see docs/spaces/huddle.md § Three categories).
#
# Uses the model's `retire!` (soft-delete: sets `retired_at`, publishes
# `huddle.room.retired` on the event bus). Retired rows stay
# resolvable for old FKs; discovery drops them.
#
# Runs once daily via config/sidekiq.yml (Kronk convention; matches
# Scheduler::KosmicDailyScheduler's shape).
class Scheduler::HuddleRoomReaper
  include Sidekiq::Worker

  sidekiq_options retry: 0

  def perform
    # `retire!` publishes an event per row; batching in `find_each`
    # keeps memory bounded if a burst of Rooms goes idle at once.
    HuddleSession.room_reap_candidates.find_each(&:retire!)
  end
end
