# frozen_string_literal: true

class Api::V1::KornersController < Api::BaseController
  skip_before_action :require_authenticated_user!, only: [:index, :show]

  # Manifests are read-only Struct instances without ActiveModel::Naming, so
  # ActiveModelSerializer's model_name lookup fails against them. Struct#to_h
  # produces the same field shape as the serializer would emit, minus the
  # AMS overhead — cleaner for this read-only surface.

  def index
    cache_even_if_authenticated!
    render json: Kronk::KornerRegistry.all.map(&:to_h)
  end

  def show
    manifest = Kronk::KornerRegistry.find(params[:id])
    return render json: { error: 'Korner not found' }, status: 404 unless manifest

    cache_even_if_authenticated!
    render json: manifest.to_h
  end
end
