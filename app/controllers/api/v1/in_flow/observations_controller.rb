# frozen_string_literal: true

class Api::V1::InFlow::ObservationsController < Api::BaseController
  skip_before_action :require_authenticated_user!, only: :show

  def show
    date      = Time.now.in_time_zone('Australia/Melbourne').to_date
    cached    = NatureObservationGenerator.fetch(date)

    if cached
      render json: { text: cached }
    else
      NatureObservationGenerator.fetch_or_enqueue(date)
      render json: { text: nil }
    end
  end
end
