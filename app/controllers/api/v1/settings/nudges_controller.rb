# frozen_string_literal: true

# Nudges preferences — which nudge event types reach the user.
# Tal audit 2026-09-13: users need per-type mute control. Muting a
# type kills both the in-app Nudges row and the push (see gates in
# `Nudges::EventRouter#call` + `NotifyService::DropCondition#drop?`).
#
#   GET /api/v1/settings/nudges  => {
#     types: [{ key, korner, korner_name, label, muted, interactive }, ...],
#     muted_types: [...]
#   }
#   PUT /api/v1/settings/nudges  body: { muted_types: [...] }
#
# Type catalogue:
#   * Person-to-person: hardcoded here — the Mastodon-native
#     notification types (`mention`, `favourite`, `follow`, ...) that
#     have no korner. Live at `korner: nil`.
#   * Korner-triggered: derived from every manifest's
#     `notifications.types` block; grouped by korner_slug. Key format
#     `<korner_slug>.<name>` so the type namespace can't collide.
class Api::V1::Settings::NudgesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  # Mastodon-native notification types + a couple of Kronk-specific
  # person-to-person ones. Any type listed here surfaces in the "People"
  # section of /settings/notifications with a `korner: nil`.
  #
  # Labels are English fallbacks — the SPA supplies i18n'd copy at
  # render time (see features/notifications_settings/nudges_section.tsx).
  PERSON_TO_PERSON = [
    { key: 'mention', label: 'Someone @-mentions you' },
    { key: 'reply', label: 'Someone replies to your post' },
    { key: 'favourite', label: 'Someone froths your post' },
    { key: 'reblog', label: 'Someone boosts your post' },
    { key: 'follow', label: 'Someone follows you' },
    { key: 'follow_request', label: 'Someone requests to follow you' },
    { key: 'mate_request', label: 'Someone sends you a Mate request' },
    { key: 'media_tag', label: 'Someone tags you in a photo' },
    { key: 'poll', label: 'A poll you voted on ends' },
  ].freeze

  def show
    render json: payload
  end

  def update
    incoming = Array(params[:muted_types]).map(&:to_s)
    known = known_keys
    filtered = incoming.uniq.select { |k| known.include?(k) }

    current_user.settings['nudges.muted_types'] = filtered
    current_user.save!
    render json: payload
  end

  private

  def payload
    { types: type_catalogue, muted_types: muted_types }
  end

  def muted_types
    Array(current_user.settings['nudges.muted_types']).map(&:to_s)
  end

  def known_keys
    type_catalogue.pluck(:key).to_set
  end

  # Builds the flat list of every nudge type the user can mute.
  # Person-to-person first (korner: nil), then one group per korner
  # ordered by name. Each row carries the current `muted` state so the
  # SPA can render checked/unchecked without a second call.
  def type_catalogue
    muted = muted_types.to_set

    p2p = PERSON_TO_PERSON.map do |row|
      row.merge(korner: nil, korner_name: nil, muted: muted.include?(row[:key]))
    end

    korner_rows = Kronk::KornerRegistry.all.flat_map do |manifest|
      # `KornerRegistry` already normalises `notifications:` — whether a
      # manifest writes it as a bare list or as `{ types: [...] }` — into a
      # flat array (see `extract_notification_types`). Digging for 'types'
      # here treated the normalised value as raw YAML and raised TypeError on
      # every request, so this endpoint has been returning 500 rather than a
      # nudge list.
      types = Array(manifest.notifications)
      types.filter_map do |t|
        raw_name = t['name'].to_s
        next nil if raw_name.blank?

        key = "#{manifest.slug}.#{raw_name}"
        {
          key: key,
          korner: manifest.slug,
          korner_name: manifest.name,
          # Fall back to a humanised name if the manifest has no explicit
          # label — matches how the schema-driven KornerSettings widget
          # handles bare setting keys.
          label: t['label'].presence || raw_name.tr('_', ' ').capitalize,
          muted: muted.include?(key),
          interactive: ActiveModel::Type::Boolean.new.cast(t['interactive']),
        }
      end
    end
    korner_rows.sort_by! { |row| [row[:korner_name].to_s, row[:label].to_s] }

    p2p + korner_rows
  end
end
