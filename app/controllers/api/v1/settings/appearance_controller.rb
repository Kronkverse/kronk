# frozen_string_literal: true

# Personal appearance & language settings (settings rebuild §7). A writeable
# read/write surface over the user's appearance-related preferences, modelled
# on KronkSettingsController. #show returns a settings schema (widget kinds
# per §K.4) plus current values, so the SPA renders it with the shared
# settings widgets and doesn't need to know these keys itself.
#
#   GET /api/v1/settings/appearance
#     => { settings_schema: [{ name:, kind:, options? }, ...], values: {...} }
#
#   PUT /api/v1/settings/appearance
#     body: { theme: 'system', default_privacy: 'unlisted', reduce_motion: true }
#     => same shape, updated. Partial — only supplied keys are written.
class Api::V1::Settings::AppearanceController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  # Public name => how it maps to a user preference. `key` is the settings
  # store key, except :locale which is the User#locale column. `options`
  # yields the enum choice list (nil for booleans).
  FIELDS = {
    'theme' => { key: 'theme', kind: 'enum', options: -> { Themes.instance.names } },
    'interface_language' => { key: :locale, kind: 'enum', options: -> { I18n.available_locales.map(&:to_s) } },
    'default_privacy' => { key: 'default_privacy', kind: 'enum', options: -> { %w(public unlisted private) } },
    'default_language' => { key: 'default_language', kind: 'enum', options: -> { [''] + LanguagesHelper::SUPPORTED_LOCALES.keys.map(&:to_s) } },
    'default_sensitive' => { key: 'default_sensitive', kind: 'boolean', options: -> {} },
    'reduce_motion' => { key: 'web.reduce_motion', kind: 'boolean', options: -> {} },
    'auto_play_gif' => { key: 'web.auto_play', kind: 'boolean', options: -> {} },
  }.freeze

  def show
    render json: payload
  end

  def update
    updates = {}
    new_locale = nil

    FIELDS.each do |name, cfg|
      next unless params.key?(name)

      value = coerce(cfg[:kind], params[name])

      return render json: { error: "invalid value for #{name}" }, status: 422 if cfg[:kind] == 'enum' && cfg[:options].call.exclude?(value)

      if cfg[:key] == :locale
        new_locale = value
      else
        updates[cfg[:key]] = value
      end
    end

    begin
      current_user.settings.update(updates) if updates.any?
      current_user.locale = new_locale unless new_locale.nil?
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
      values: {
        'theme' => current_user.settings['theme'],
        'interface_language' => current_user.locale,
        'default_privacy' => current_user.settings['default_privacy'],
        'default_language' => current_user.settings['default_language'],
        'default_sensitive' => current_user.settings['default_sensitive'],
        'reduce_motion' => current_user.settings['web.reduce_motion'],
        'auto_play_gif' => current_user.settings['web.auto_play'],
      },
    }
  end
end
