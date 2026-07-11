# frozen_string_literal: true

# Per-korner user settings — see spec §K.
#
# Endpoints:
#   GET    /api/v1/korners                  — index + tune-in state
#   GET    /api/v1/korners/:slug            — manifest + tune-in state
#   POST   /api/v1/korners/:slug/tune_out   — tune out
#   DELETE /api/v1/korners/:slug/tune_out   — tune in (idempotent alias)
#   POST   /api/v1/korners/:slug/tune_in    — tune in (spec §K.9)
#   GET    /api/v1/korners/:slug/settings   — settings payload for viewer
#   PATCH  /api/v1/korners/:slug/settings/:name — set one value (autosave)
#   DELETE /api/v1/korners/:slug/settings/:name — reset to manifest default
#   POST   /api/v1/korners/:slug/settings   — bulk update (kept for
#     backward-compat with earlier client; prefer per-name PATCH)
class Api::V1::KornersController < Api::BaseController
  READ_ACTIONS  = [:settings_show].freeze
  WRITE_ACTIONS = [:tune_out, :tune_in, :settings_update, :setting_patch, :setting_delete].freeze

  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: READ_ACTIONS
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: WRITE_ACTIONS
  before_action :require_user!, only: (READ_ACTIONS + WRITE_ACTIONS)
  before_action :set_manifest, only: [:show, :tune_out, :tune_in, :settings_show, :settings_update, :setting_patch, :setting_delete]

  skip_before_action :require_authenticated_user!, only: [:index, :show]

  def index
    tuned_out = tuned_out_slugs
    counts = Kronk::TuneInCounts.for_all_korners
    render json: Kronk::KornerRegistry.all.map { |m|
      m.to_h.merge(
        'tuned_in' => !tuned_out.include?(m.slug),
        'tune_in_count' => counts.fetch(m.slug, 0)
      )
    }
  end

  def show
    tuned_out = tuned_out_slugs
    render json: @manifest.to_h.merge(
      'tuned_in' => !tuned_out.include?(@manifest.slug),
      'tune_in_count' => Kronk::TuneInCounts.for_korner(@manifest.slug)
    )
  end

  def tune_out
    current_account.tune_out!(@manifest.slug)
    render json: { tuned_in: false, slug: @manifest.slug }
  end

  def tune_in
    current_account.tune_in!(@manifest.slug)
    render json: { tuned_in: true, slug: @manifest.slug }
  end

  def settings_show
    render json: settings_payload(load_settings_row)
  end

  # PATCH /api/v1/korners/:slug/settings/:name — spec §K.9 canonical
  # autosave path. Body: { value: <native-json> } or { push_enabled: <bool> }
  # for the push-per-notification-type reserved name space
  # (`push.<notification_type>`).
  def setting_patch
    name = params[:name].to_s
    row  = load_settings_row(create_if_missing: true)

    if (push_type = name.match(/\Apush\.(.+)\z/)&.[](1))
      # Push preference for one notification type. Manifest must declare
      # that type; framework fabricates the storage.
      return render(json: { error: "unknown notification type '#{push_type}'" }, status: 422) unless notification_defined?(push_type)

      row.push_preferences = (row.push_preferences || {}).merge(push_type => cast_bool(params[:value]))
    else
      definition = settings_definition(name)
      return render(json: { error: "unknown setting '#{name}'" }, status: 422) unless definition

      row.values = (row.values || {}).merge(name => coerce_value(definition, params[:value]))
    end

    row.save!
    render json: settings_payload(row)
  rescue ActiveRecord::RecordInvalid, ArgumentError, TypeError => e
    render json: { error: e.message }, status: 422
  end

  # DELETE /api/v1/korners/:slug/settings/:name — reset one setting to
  # its manifest default.
  def setting_delete
    name = params[:name].to_s
    row  = load_settings_row
    return render(json: settings_payload(nil)) if row.nil?

    if (push_type = name.match(/\Apush\.(.+)\z/)&.[](1))
      row.push_preferences = (row.push_preferences || {}).except(push_type)
    else
      return render(json: { error: "unknown setting '#{name}'" }, status: 422) unless settings_definition(name)

      row.values = (row.values || {}).except(name)
    end

    row.save!
    render json: settings_payload(row)
  end

  # POST /api/v1/korners/:slug/settings — legacy bulk update (retained
  # for the initial React client until it moves to per-name PATCH).
  def settings_update
    row = load_settings_row(create_if_missing: true)

    unless params[:push_enabled].nil?
      row.push_enabled = ActiveModel::Type::Boolean.new.cast(params[:push_enabled])
    end

    Array(params[:push_preferences]).each do |type, enabled|
      next unless notification_defined?(type.to_s)

      row.push_preferences = (row.push_preferences || {}).merge(type.to_s => cast_bool(enabled))
    end

    values = row.values.dup
    Array(params[:values]).each do |name, value|
      definition = settings_definition(name.to_s)
      next unless definition

      values[name.to_s] = coerce_value(definition, value)
    end
    row.values = values

    row.save!
    render json: settings_payload(row)
  rescue ActiveRecord::RecordInvalid, ArgumentError => e
    render json: { error: e.message }, status: 422
  end

  private

  def set_manifest
    @manifest = Kronk::KornerRegistry.find(params[:id] || params[:korner_id])
    render(json: { error: 'Korner not found' }, status: 404) unless @manifest
  end

  def tuned_out_slugs
    return Set.new unless current_account

    current_account.korner_tune_outs.pluck(:korner_slug).to_set
  end

  def settings_payload(row)
    stored_values = row&.values || {}
    stored_pushes = row&.push_preferences || {}

    values = Array(@manifest.settings).each_with_object({}) do |s, hash|
      name = s['name']
      next unless name

      hash[name] = stored_values.fetch(name.to_s, s['default'])
    end

    # Push preferences: one entry per notification type declared in the
    # manifest, defaulting to the manifest's `default_push` value.
    push_preferences = Array(@manifest.notifications).each_with_object({}) do |n, hash|
      name = n.is_a?(Hash) ? n['name'] : n
      next unless name

      default = n.is_a?(Hash) && n.key?('default_push') ? n['default_push'] : true
      hash[name.to_s] = stored_pushes.fetch(name.to_s, default)
    end

    {
      slug: @manifest.slug,
      tuned_in: !tuned_out_slugs.include?(@manifest.slug),
      push_enabled: row.nil? ? true : row.push_enabled,
      push_preferences: push_preferences,
      values: values,
      # Echo the manifest's settings and notifications shape so the
      # client renders the right widgets without re-fetching the whole
      # manifest.
      settings_schema: Array(@manifest.settings),
      notifications_schema: Array(@manifest.notifications),
    }
  end

  def settings_definition(name)
    Array(@manifest.settings).find { |s| s['name'].to_s == name.to_s }
  end

  def notification_defined?(name)
    Array(@manifest.notifications).any? do |n|
      (n.is_a?(Hash) ? n['name'] : n).to_s == name.to_s
    end
  end

  def load_settings_row(create_if_missing: false)
    scope = UserKornerSetting.where(user_id: current_user.id, korner_slug: @manifest.slug)
    row = scope.first
    return row if row
    return nil unless create_if_missing

    UserKornerSetting.new(user_id: current_user.id, korner_slug: @manifest.slug)
  end

  # Per spec §K.4 widget kinds. Unknown kinds fall through as-is so the
  # framework doesn't reject values the manifest author has taken on to
  # define.
  def coerce_value(definition, value)
    case definition['kind']
    when 'boolean'                       then cast_bool(value)
    when 'integer'                       then cast_integer(definition, value)
    when 'number'                        then Float(value)
    when 'string'                        then coerce_string(definition, value)
    when 'enum'                          then coerce_enum(definition, value)
    when 'multi_enum'                    then coerce_multi_enum(definition, value)
    when 'duration'                      then coerce_duration(definition, value)
    when 'account_list'                  then Array(value).map(&:to_s).uniq
    else value
    end
  rescue ArgumentError, TypeError
    value
  end

  def cast_bool(value)
    ActiveModel::Type::Boolean.new.cast(value)
  end

  def cast_integer(definition, value)
    n = Integer(value)
    n = definition['min'] if definition['min'] && n < definition['min']
    n = definition['max'] if definition['max'] && n > definition['max']
    n
  end

  def coerce_string(definition, value)
    s = value.to_s
    limit = definition['max_length']
    limit ? s[0, limit] : s
  end

  def coerce_enum(definition, value)
    return value unless Array(definition['options']).any?

    Array(definition['options']).map(&:to_s).include?(value.to_s) ? value.to_s : definition['default']
  end

  def coerce_multi_enum(definition, value)
    options = Array(definition['options']).map(&:to_s).to_set
    Array(value).map(&:to_s).uniq.select { |v| options.include?(v) }
  end

  # Accept an ISO 8601 duration (PT15M, PT1H, P1D) or an integer number
  # of seconds. Store as ISO 8601 for consistency.
  def coerce_duration(_definition, value)
    return value.to_s if value.is_a?(String) && value.match?(/\AP(T?\d+[YMDWHS]?)+\z/i)

    seconds = Integer(value)
    return "PT#{seconds}S" if seconds < 60
    return "PT#{seconds / 60}M" if seconds < 3600
    return "PT#{seconds / 3600}H" if seconds < 86_400

    "P#{seconds / 86_400}D"
  end
end
