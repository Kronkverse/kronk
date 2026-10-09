# frozen_string_literal: true

# GET /api/v1/kronk_build => { "build": "<id>" }
#
# Polled by open tabs to notice a deploy (Kronk::Build). Public and tiny, and
# never cached anywhere: a cached answer is exactly the stale view this
# exists to end.
class Api::V1::KronkBuildController < Api::BaseController
  skip_before_action :require_authenticated_user!, raise: false

  def show
    response.headers['Cache-Control'] = 'no-store'
    render json: { build: Kronk::Build.id }
  end
end
