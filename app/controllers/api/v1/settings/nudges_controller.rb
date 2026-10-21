# frozen_string_literal: true

# Nudges preferences: which kinds of nudge reach the user.
# docs/spaces/nudges.md (Nudge settings).
#
#   GET /api/v1/settings/nudges  => {
#     types: [{ key, korner, korner_name, label, muted, push }, ...],
#     message_types: [{ key, label, push }, ...],
#     muted_types: [...],
#     push_off_types: [...],
#     quiet_hours: { start: 'HH:MM', end: 'HH:MM' }
#   }
#   PUT /api/v1/settings/nudges  body: any of { muted_types: [...],
#     push_off_types: [...], quiet_hours: { start, end } }
#
# `push` is "send this to my phone" (Nudges::PushPreferences). Quiet hours
# hold push back, never the nudge itself (Nudges::QuietHours); equal start
# and end turns them off.
#
# The rows come from Nudges::MuteCatalogue, which builds them from what is
# actually delivered, so each key is the one the delivery paths check
# (`Nudges::EventRouter`, `NotifyService`, `Kronk::KornerNotifier`).
# `korner: nil` rows are the "People" group.
class Api::V1::Settings::NudgesController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  TIME = /\A([01]\d|2[0-3]):[0-5]\d\z/

  def show
    render json: payload
  end

  def update
    # A form-encoded empty list arrives as no key at all, so a request
    # carrying neither of the other fields is about the mute list.
    if params.key?(:muted_types) || !(params.key?(:push_off_types) || params.key?(:quiet_hours))
      known = Nudges::MuteCatalogue.keys.to_set
      current_user.settings[Nudges::MuteCatalogue::SETTING] = incoming(:muted_types).select { |k| known.include?(k) }
    end
    if params.key?(:push_off_types)
      known = Nudges::PushPreferences.keys.to_set
      current_user.settings[Nudges::PushPreferences::SETTING] = incoming(:push_off_types).select { |k| known.include?(k) }
    end
    current_user.save!
    save_quiet_hours if params.key?(:quiet_hours)

    render json: payload
  end

  private

  def incoming(name)
    Array(params[name]).map(&:to_s).uniq
  end

  def save_quiet_hours
    start_at = params.dig(:quiet_hours, :start).to_s
    end_at   = params.dig(:quiet_hours, :end).to_s
    raise Mastodon::ValidationError, 'quiet hours are HH:MM' unless TIME.match?(start_at) && TIME.match?(end_at)

    row = UserKornerSetting.find_or_initialize_by(user_id: current_user.id, korner_slug: Nudges::QuietHours::KORNER_SLUG)
    row.values = (row.values || {}).merge('quiet_hours_start' => start_at, 'quiet_hours_end' => end_at)
    row.save!
  end

  def payload
    muted = Nudges::MuteCatalogue.muted_keys(current_user)
    push_off = Nudges::PushPreferences.off_keys(current_user)
    types = Nudges::MuteCatalogue.rows(muted: muted.to_set).map { |row| row.merge(push: !push_off.include?(row[:key])) }
    known = types.pluck(:key).to_set
    {
      types: types,
      message_types: Nudges::PushPreferences.message_rows(current_user),
      muted_types: muted.select { |k| known.include?(k) },
      push_off_types: push_off,
      quiet_hours: quiet_hours,
    }
  end

  def quiet_hours
    {
      start: Nudges::QuietHours.read_setting(current_user, 'quiet_hours_start') || Nudges::QuietHours::DEFAULT_START,
      end: Nudges::QuietHours.read_setting(current_user, 'quiet_hours_end') || Nudges::QuietHours::DEFAULT_END,
    }
  end
end
