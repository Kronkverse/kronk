# frozen_string_literal: true

# Posting defaults (settings rebuild §7; settings.posting node). The defaults
# applied when you compose a post — visibility, language, sensitivity. These
# were previously mislodged in AppearanceController; they're posting concerns,
# not look-and-feel. See docs/kronk_settings_ia.md.
#
#   GET  /api/v1/settings/posting  => { settings_schema: [...], values: {...} }
#   PUT  /api/v1/settings/posting  body: { default_privacy: 'unlisted' } (partial)
#
# Schema-driven so the SPA renders it with the shared settings widgets.
class Api::V1::Settings::PostingController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:update]
  before_action :require_user!

  FIELDS = {
    # The reach ladder (docs/kronk_feed_and_reach.md §2) — the follower-model
    # scopes (unlisted/private) are retired from the picker.
    'default_privacy' => { key: 'default_privacy', kind: 'enum', options: -> { %w(public orbit mates self_only) } },
    'default_quote_policy' => { key: 'default_quote_policy', kind: 'enum', options: -> { %w(public followers nobody) } },
    'default_language' => { key: 'default_language', kind: 'enum', options: -> { [''] + LanguagesHelper::SUPPORTED_LOCALES.keys.map(&:to_s) } },
    'default_sensitive' => { key: 'default_sensitive', kind: 'boolean', options: -> {} },
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

  # Map a legacy follower-model default onto the nearest reach tier so the
  # widget shows an in-range option (see the reach ladder above).
  def reach_default_privacy
    case current_user.settings['default_privacy']
    when 'private' then 'mates'
    when 'unlisted' then 'public'
    else current_user.settings['default_privacy']
    end
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
        'default_privacy' => reach_default_privacy,
        'default_quote_policy' => current_user.settings['default_quote_policy'],
        'default_language' => current_user.settings['default_language'],
        'default_sensitive' => current_user.settings['default_sensitive'],
      },
    }
  end
end
