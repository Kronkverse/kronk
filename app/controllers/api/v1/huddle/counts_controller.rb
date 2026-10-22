# frozen_string_literal: true

# How many are in the Main Huddle, for the home feed's LiveBanner.
#
#   GET /api/v1/huddle/count  -> { participants: <n> }
#
# The banner used to ask the Jitsi server from every browser. Jitsi answers
# an empty room with a 404, which the browser logs as a failed load on every
# poll, and every viewer polled it. The server already asks once a minute
# (Scheduler::HuddleFomoScheduler), so the banner reads that count instead.
# Nothing seen lately reads as nobody there.
class Api::V1::Huddle::CountsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read }
  before_action :require_user!

  def show
    render json: { participants: Kronk::HuddleCount.last_seen || 0 }
  end
end
