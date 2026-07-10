# frozen_string_literal: true

class Api::V1::KornersController < Api::BaseController
  skip_before_action :require_authenticated_user!, only: [:index, :show]

  def index
    cache_even_if_authenticated!
    render json: Kronk::KornerRegistry.all, each_serializer: REST::V1::KornerSerializer
  end

  def show
    manifest = Kronk::KornerRegistry.find(params[:id])
    return render json: { error: 'Korner not found' }, status: 404 unless manifest

    cache_even_if_authenticated!
    render json: manifest, serializer: REST::V1::KornerSerializer
  end
end
