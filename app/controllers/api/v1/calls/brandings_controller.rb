# frozen_string_literal: true

# Jitsi's own words for a Booth live set (docs/spaces/booth.md, Live sets,
# The words). Jitsi says "Join meeting" and "Rosa joined the meeting"; a live
# set isn't a meeting. Those sentences are Jitsi's, drawn inside its page,
# and the embed can't change them. Jitsi's dynamic branding can: with
#
#   config.brandingDataUrl = 'https://<kronk>/api/v1/calls/branding';
#
# in the Jitsi server's config.js, every call's page asks here first
#
#   GET /api/v1/calls/branding?conferenceFqn=<tenant/>room
#     -> { labels: { en: {...}, enGB: {...} } }   a live set's room
#     -> {}                                       any other (Jitsi's defaults)
#
# and lays `labels[<its language>]` over its own English. The words are
# `kronk_jitsi.booth_live` in config/locales/kronk/overrides.yml, keyed as
# Jitsi's lang/main.json is. The Huddle and Kuddles keep Jitsi's words.
#
# The server's page calls this with no user and no token, so it is open to
# anyone: it holds only copy. A live set's room is known by its name
# (BoothLive#assign_room_key: "booth-" and 20 hex digits, after any
# JITSI_ROOM_PREFIX), so one Kronk can answer for every Kronk on the server.
class Api::V1::Calls::BrandingsController < Api::BaseController
  BOOTH_LIVE_ROOM = /booth-\h{20}\z/
  # Jitsi's own codes for English: `en`, and `enGB` for a British browser.
  JITSI_LANGUAGES = %w(en enGB).freeze

  skip_before_action :require_authenticated_user!, raise: false

  def show
    expires_in 5.minutes, public: true
    render json: booth_live_room? ? { labels: JITSI_LANGUAGES.index_with { booth_live_labels } } : {}
  end

  private

  def booth_live_room?
    room = params[:conferenceFqn].to_s.split('/').last.to_s.downcase
    BOOTH_LIVE_ROOM.match?(room)
  end

  def booth_live_labels
    I18n.t('kronk_jitsi.booth_live', locale: :en)
  end
end
