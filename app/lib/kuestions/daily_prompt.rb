# frozen_string_literal: true

# Kuestions daily prompt selector.
#
# Loads the seed pack once at boot (`config/kuestions_daily_prompts.yml`
# — a bigger authored pool arrives as a separate process). Selects
# one prompt per calendar day by hashing the ISO date into an index —
# everyone sees the same prompt on the same day, without any per-user
# state or DB round-trip.
#
# See docs/spaces/kuestions.md §Prompt source.
module Kuestions
  module DailyPrompt
    module_function

    CONFIG_PATH = Rails.root.join('config', 'kuestions_daily_prompts.yml').freeze

    def prompts
      @prompts ||= (YAML.load_file(CONFIG_PATH)['prompts'] || []).freeze
    end

    # Deterministic pick for a given date (default: today in UTC).
    def for_date(date = Date.current)
      return nil if prompts.empty?

      idx = Zlib.crc32(date.iso8601) % prompts.size
      prompts[idx]
    end
  end
end
