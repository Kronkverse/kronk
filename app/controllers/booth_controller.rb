# frozen_string_literal: true

class BoothController < ApplicationController
  include WebAppControllerConcern

  skip_before_action :require_functional!, only: [:index, :embed]

  content_security_policy only: :embed do |policy|
    policy.frame_ancestors(:any)
  end

  def index; end

  def embed
    @booth_set = BoothSet.published.find(params[:id])
    expires_in 180, public: true
    response.headers.delete('X-Frame-Options')
    render layout: false
  rescue ActiveRecord::RecordNotFound
    not_found
  end
end
