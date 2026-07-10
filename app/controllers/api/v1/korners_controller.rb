# frozen_string_literal: true

class Api::V1::KornersController < Api::BaseController
  before_action -> { doorkeeper_authorize! :read, :'read:accounts' }, only: [:settings_show]
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:tune_out, :tune_in, :settings_update]
  before_action :require_user!, only: [:tune_out, :tune_in, :settings_show, :settings_update]
  before_action :set_manifest, only: [:show, :tune_out, :tune_in, :settings_show, :settings_update]

  skip_before_action :require_authenticated_user!, only: [:index, :show]

  # Manifests are read-only Struct instances without ActiveModel::Naming, so
  # ActiveModelSerializer's model_name lookup fails against them. Struct#to_h
  # produces the same field shape as the serializer would emit, minus the
  # AMS overhead — cleaner for this read-only surface.

  def index
    # No shared cache when we're personalising the response with tune-in
    # state; without this every viewer would inherit the first cached body.
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

  # Per-korner user settings (spec §K). Merges framework state
  # (tune-in, push toggle) with the manifest's user-scoped settings.
  # Storage lives in UserKornerSetting keyed by (user_id, korner_slug).
  def settings_show
    render json: settings_payload(load_settings_row)
  end

  def settings_update
    row = load_settings_row(create_if_missing: true)

    unless params[:push_enabled].nil?
      row.push_enabled = ActiveModel::Type::Boolean.new.cast(params[:push_enabled])
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
    @manifest = Kronk::KornerRegistry.find(params[:id])
    render(json: { error: 'Korner not found' }, status: 404) unless @manifest
  end

  # For anonymous callers, everyone is tuned in to everything.
  def tuned_out_slugs
    return Set.new unless current_account

    current_account.korner_tune_outs.pluck(:korner_slug).to_set
  end

  def settings_payload(row)
    stored_values = row&.values || {}
    values = Array(@manifest.settings).each_with_object({}) do |s, hash|
      name = s['name']
      next unless name

      hash[name] = stored_values.fetch(name.to_s, s['default'])
    end

    {
      slug: @manifest.slug,
      tuned_in: !tuned_out_slugs.include?(@manifest.slug),
      push_enabled: row.nil? ? true : row.push_enabled,
      values: values,
    }
  end

  def settings_definition(name)
    Array(@manifest.settings).find { |s| s['name'].to_s == name.to_s }
  end

  def load_settings_row(create_if_missing: false)
    scope = UserKornerSetting.where(user_id: current_user.id, korner_slug: @manifest.slug)
    row = scope.first
    return row if row
    return nil unless create_if_missing

    UserKornerSetting.new(user_id: current_user.id, korner_slug: @manifest.slug)
  end

  # Best-effort coercion by declared setting kind. Unknown kinds fall
  # through as-is; the manifest owner is expected to declare what they
  # want the storage type to be.
  def coerce_value(definition, value)
    case definition['kind']
    when 'boolean' then ActiveModel::Type::Boolean.new.cast(value)
    when 'integer' then Integer(value)
    when 'number'  then Float(value)
    when 'string'  then value.to_s
    else value
    end
  rescue ArgumentError, TypeError
    value
  end
end
