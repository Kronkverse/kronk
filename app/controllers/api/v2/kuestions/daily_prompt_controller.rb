# frozen_string_literal: true

# GET /api/v2/kuestions/prompt/today — today's Kronk-curated prompt.
# Powers the post-box placeholder + Today panel per docs/spaces/kuestions.md.
class Api::V2::Kuestions::DailyPromptController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:statuses' }
  before_action :require_user!

  def show
    render json: { date: Date.current.iso8601, prompt: Kuestions::DailyPrompt.for_date }
  end
end
