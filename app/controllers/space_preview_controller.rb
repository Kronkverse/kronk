# frozen_string_literal: true

class SpacePreviewController < ApplicationController
  skip_before_action :require_functional!
  skip_before_action :authenticate_user!

  SPACES = {
    'kalendar' => {
      name: '₭alendar',
      tagline: 'Events, gatherings & moments across the Kronk community.',
    },
    'kommons' => {
      name: '₭ommons',
      tagline: 'Propose ideas, vote on decisions and shape the direction of the Kronk community.',
    },
  }.freeze

  def show
    @space = SPACES[params[:space]]
    render status: :not_found and return if @space.nil?
    render layout: false
  end
end
