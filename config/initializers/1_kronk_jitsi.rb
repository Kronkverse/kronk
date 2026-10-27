# frozen_string_literal: true

# Huddle's video server. Huddle embeds Jitsi from this host (the external
# API script, the room iframe and the lobby's who's-in poll), so the web
# client, the CSP and Kalendar's Huddle events all read it from here
# rather than naming a host in code (CLAUDE.md, "No instance in the code").
# Set JITSI_DOMAIN to a bare host, e.g. `meet.example.org`. Loads before
# content_security_policy.rb, which allows it.
#
# Kronk's own Jitsi server (docs/decisions.md, 2026-10-27) lets people in
# only with a pass, a JWT Kronk signs (Kronk::Jitsi). All of these are
# optional, so Kronk keeps working on a server without tokens:
#
#   JITSI_JWT_SECRET       the shared HS256 secret. Blank: no passes, the
#                          old open-server behaviour, and no recording.
#   JITSI_JWT_APP_ID       the token's `iss`, the server's app id ("kronk").
#   JITSI_ROOM_PREFIX      put before every Jitsi room name Kronk uses
#                          ("shadow-" on shadow), so two Kronks can share
#                          one server without meeting. Never stored.
#   JITSI_RECORDING_SECRET signs the recorder's calls to
#                          /api/v1/calls/recordings (HMAC). Blank: those
#                          endpoints are off.
#
# Secrets live in the environment, never in this public repo.
Rails.application.configure do
  config.x.kronk_jitsi_domain = ENV.fetch('JITSI_DOMAIN', 'meet.talitamoss.info')
  config.x.kronk_jitsi_jwt_secret = ENV.fetch('JITSI_JWT_SECRET', '')
  config.x.kronk_jitsi_jwt_app_id = ENV.fetch('JITSI_JWT_APP_ID', '').presence || 'kronk'
  config.x.kronk_jitsi_room_prefix = ENV.fetch('JITSI_ROOM_PREFIX', '')
  config.x.kronk_jitsi_recording_secret = ENV.fetch('JITSI_RECORDING_SECRET', '')

  # Where a call recording is played from: a short-lived signed URL on the
  # bucket's own host (not the media CDN), which the CSP's media-src must
  # allow. Nil without S3.
  s3_bucket = ENV.fetch('S3_BUCKET', '')
  s3_endpoint = ENV.fetch('S3_ENDPOINT', '')
  config.x.kronk_call_recordings_host =
    if ENV.fetch('S3_ENABLED', 'false') == 'true' && s3_bucket.present?
      if s3_endpoint.present?
        endpoint = URI.parse(s3_endpoint)
        host = ENV.fetch('S3_OVERRIDE_PATH_STYLE', 'false') == 'true' ? "#{s3_bucket}.#{endpoint.host}" : endpoint.host
        port = endpoint.port == endpoint.default_port ? '' : ":#{endpoint.port}"
        "#{endpoint.scheme}://#{host}#{port}"
      else
        "https://#{s3_bucket}.s3.#{ENV.fetch('S3_REGION', 'us-east-1')}.amazonaws.com"
      end
    end
end
