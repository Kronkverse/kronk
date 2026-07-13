# frozen_string_literal: true

# Personal notification settings (settings rebuild §7). Read/write surface
# over the user's notification-email preferences, modelled on
# AppearanceController. #show returns a settings schema (widget kinds per
# §K.4) plus current values so the SPA renders it with the shared settings
# widgets.
#
# Scope note: per-type IN-APP alerts live on the Web Push subscription and
# the classic bell surface is retired for Nudges, so this section exposes the
# email preferences (the real user-settings keys). Nudge preferences have no
# backing store yet (windows are korner-manifest config), so none are here.
#
#   GET /api/v1/settings/notifications
#     => { settings_schema: [{ name:, kind:, options? }, ...], values: {...} }
#   PUT /api/v1/settings/notifications
#     body: { email_mention: false, email_software_updates: 'critical' }
#     => same shape, updated. Partial — only supplied keys are written.
class Api::V1::Settings::NotificationsController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  # Public name => user-settings store key (all under notification_emails).
  # options yields enum choices (nil for booleans).
  FIELDS = {
    'email_mention' => { key: 'notification_emails.mention', kind: 'boolean', options: -> {} },
    'email_follow' => { key: 'notification_emails.follow', kind: 'boolean', options: -> {} },
    'email_follow_request' => { key: 'notification_emails.follow_request', kind: 'boolean', options: -> {} },
    'email_reblog' => { key: 'notification_emails.reblog', kind: 'boolean', options: -> {} },
    'email_favourite' => { key: 'notification_emails.favourite', kind: 'boolean', options: -> {} },
    'email_quote' => { key: 'notification_emails.quote', kind: 'boolean', options: -> {} },
    'email_event_invitation' => { key: 'notification_emails.event_invitation', kind: 'boolean', options: -> {} },
    'email_software_updates' => { key: 'notification_emails.software_updates', kind: 'enum', options: -> { %w(none critical patch all) } },
  }.freeze

  def show
    render json: payload
  end

  def update
    updates = {}

    FIELDS.each do |name, cfg|
      next unless params.key?(name)

      value = coerce(cfg[:kind], params[name])

      return render json: { error: "invalid value for #{name}" }, status: 422 if cfg[:kind] == 'enum' && cfg[:options].call.exclude?(value)

      updates[cfg[:key]] = value
    end

    begin
      current_user.settings.update(updates) if updates.any?
      current_user.save!
    rescue ArgumentError => e
      return render json: { error: e.message }, status: 422
    end

    render json: payload
  end

  private

  def coerce(kind, raw)
    kind == 'boolean' ? ActiveModel::Type::Boolean.new.cast(raw) : raw.to_s
  end

  def payload
    {
      settings_schema: FIELDS.map do |name, cfg|
        schema = { name: name, kind: cfg[:kind] }
        options = cfg[:options].call
        schema[:options] = options unless options.nil?
        schema
      end,
      values: FIELDS.transform_values { |cfg| current_user.settings[cfg[:key]] },
    }
  end
end
