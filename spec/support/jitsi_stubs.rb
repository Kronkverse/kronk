# frozen_string_literal: true

# Browser specs open the Huddle, Kuddles and the Booth, whose pages ask Kronk
# who is in a call; Kronk asks the Jitsi server, which a spec can't reach.
# Jitsi answers 404 for a room nobody is in, so every call reads as empty.
# A request spec that cares stubs its own answer.
RSpec.configure do |config|
  config.before(type: :system) do
    stub_request(:get, %r{\Ahttps://#{Regexp.escape(Rails.configuration.x.kronk_jitsi_domain)}/room(-size)?\?})
      .to_return(status: 404)
  end
end
