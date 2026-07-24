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
    # NOTE: default_privacy / default_language / default_sensitive are *posting*
    # defaults, not appearance — they live in Api::V1::Settings::PostingController
    # (settings.posting). See docs/kronk_settings_ia.md.
    'reduce_motion' => { key: 'web.reduce_motion', kind: 'boolean', options: -> {} },
    'auto_play_gif' => { key: 'web.auto_play', kind: 'boolean', options: -> {} },
    # Kronk Personal Appearance. personal_accent is a purple hex (validated by
    # hue below — kept out of `enum` because it's a continuous constraint).
    'personal_accent' => { key: 'web.personal_accent', kind: 'accent', options: -> {} },
    # Kronk Personal Appearance — purple hue slider. Rotates the whole
    # --kronk-purple-* family (primary/bright/deep/muted/accent) around
    # a shared L+C anchor so the palette warms or cools as one. Range
    # clamped to the purple band (260-310); anything outside drifts
    # into pure blue or magenta.
    'personal_purple_hue' => { key: 'web.personal_purple_hue', kind: 'hue', options: -> {} },
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

      if cfg[:kind] == 'hue'
        value = coerce_hue(params[name])
        return render json: { error: "#{name} must be an integer 260-350 or null" }, status: 422 if value == :invalid
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

  # Coerce a hue param: nil / blank clears the override; an integer in
  # [260, 350] is stored as-is; anything else is a validation failure.
  # Range window sits the anchor (285°) about a quarter from the cool
  # end (blue-violet at 260°) with the bulk of travel going warm into
  # magenta / plum territory (up to 350°). Above 350 drifts into red;
  # below 260 into pure blue. Returns the coerced value or the
  # sentinel :invalid so the caller can render 422 without a raise.
  def coerce_hue(raw)
    return nil if raw.nil? || raw.to_s.strip.empty?

    n = Integer(raw.to_s, exception: false)
    return :invalid if n.nil?
    return :invalid unless n.between?(260, 350)

    n
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
        'reduce_motion' => current_user.settings['web.reduce_motion'],
        'auto_play_gif' => current_user.settings['web.auto_play'],
        'personal_accent' => current_user.settings['web.personal_accent'],
        # UserSettings::Setting with a nil default type-casts stored
        # values through ActiveModel::Type::String, so an integer
        # written to the store comes back as `"285"`. Cast back to
        # Integer here so the client always sees a number — otherwise
        # the settings widget's numeric check fails and the slider
        # snaps to the anchor on every save/reload.
        'personal_purple_hue' => current_user.settings['web.personal_purple_hue'].then { |raw| raw.present? ? raw.to_i : nil },
        'personal_font_display' => current_user.settings['web.personal_font_display'],
        'personal_font_body' => current_user.settings['web.personal_font_body'],
        'ui_scale' => current_user.settings['web.ui_scale'],
      },
    }
  end
end
