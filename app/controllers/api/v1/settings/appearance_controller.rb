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
    # Kronk Personal Appearance. personal_accent is a purple hex (validated by
    # hue below — kept out of `enum` because it's a continuous constraint).
    'personal_accent' => { key: 'web.personal_accent', kind: 'accent', options: -> {} },
    'personal_font_display' => { key: 'web.personal_font_display', kind: 'enum', options: -> { %w(default playfair fraunces cormorant lora merriweather garamond spectral) } },
    'personal_font_body' => { key: 'web.personal_font_body', kind: 'enum', options: -> { %w(default inter ibm-plex manrope work-sans dm-sans figtree system) } },
    'ui_scale' => { key: 'web.ui_scale', kind: 'enum', options: -> { %w(small default large xl) } },
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

      if cfg[:kind] == 'accent'
        value = value.presence # blank clears the override
        return render json: { error: "#{name} must be a purple hex colour" }, status: 422 unless purple_accent?(value)
      end

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

  # Personal accent must stay in the purple family so the platform still reads
  # as Kronk. Accepts blank (clears the override) or a #rrggbb whose hue sits in
  # the indigo→violet→magenta-purple band. Near-greys (no meaningful hue) are
  # rejected.
  def purple_accent?(hex)
    return true if hex.blank?
    return false unless hex.match?(/\A#\h{6}\z/)

    r = hex[1, 2].to_i(16) / 255.0
    g = hex[3, 2].to_i(16) / 255.0
    b = hex[5, 2].to_i(16) / 255.0
    max = [r, g, b].max
    delta = max - [r, g, b].min
    return false if delta < 0.06

    hue = case max
          when r then 60 * (((g - b) / delta) % 6)
          when g then 60 * (((b - r) / delta) + 2)
          else 60 * (((r - g) / delta) + 4)
          end
    hue += 360 if hue.negative?
    hue.between?(240, 320)
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
        'personal_accent' => current_user.settings['web.personal_accent'],
        'personal_font_display' => current_user.settings['web.personal_font_display'],
        'personal_font_body' => current_user.settings['web.personal_font_body'],
        'ui_scale' => current_user.settings['web.ui_scale'],
      },
    }
  end
end
