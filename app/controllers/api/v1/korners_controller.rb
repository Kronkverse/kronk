# frozen_string_literal: true

class Api::V1::KornersController < Api::BaseController
  before_action -> { doorkeeper_authorize! :write, :'write:accounts' }, only: [:tune_out, :tune_in]
  before_action :require_user!, only: [:tune_out, :tune_in]
  before_action :set_manifest, only: [:show, :tune_out, :tune_in]

  skip_before_action :require_authenticated_user!, only: [:index, :show]

  # Manifests are read-only Struct instances without ActiveModel::Naming, so
  # ActiveModelSerializer's model_name lookup fails against them. Struct#to_h
  # produces the same field shape as the serializer would emit, minus the
  # AMS overhead — cleaner for this read-only surface.

  def index
    # No shared cache when we're personalising the response with tune-in
    # state; without this every viewer would inherit the first cached body.
    tuned_out = tuned_out_slugs
    render json: Kronk::KornerRegistry.all.map { |m| m.to_h.merge('tuned_in' => !tuned_out.include?(m.slug)) }
  end

  def show
    tuned_out = tuned_out_slugs
    render json: @manifest.to_h.merge('tuned_in' => !tuned_out.include?(@manifest.slug))
  end

  def tune_out
    current_account.tune_out!(@manifest.slug)
    render json: { tuned_in: false, slug: @manifest.slug }
  end

  def tune_in
    current_account.tune_in!(@manifest.slug)
    render json: { tuned_in: true, slug: @manifest.slug }
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
end
