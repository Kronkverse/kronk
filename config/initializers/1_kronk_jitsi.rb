# frozen_string_literal: true

# Huddle's video server. Huddle embeds Jitsi from this host (the external
# API script, the room iframe and the lobby's who's-in poll), so the web
# client, the CSP and Kalendar's Huddle events all read it from here
# rather than naming a host in code (CLAUDE.md, "No instance in the code").
# Set JITSI_DOMAIN to a bare host, e.g. `meet.example.org`. Loads before
# content_security_policy.rb, which allows it.
Rails.application.configure do
  config.x.kronk_jitsi_domain = ENV.fetch('JITSI_DOMAIN', 'meet.talitamoss.info')
end
